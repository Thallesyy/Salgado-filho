"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, PCFShadowMap, type PerspectiveCamera, Vector3 } from "three";
import { GALLERY_SHOTS } from "@/lib/content";
import { direct } from "@/lib/director";
import { frame } from "@/lib/frame";
import { setGalleryImages } from "@/lib/gallery";
import { rememberSafeMode, type Tier } from "@/lib/gpu";
import { journey } from "@/lib/journey";
import { clamp, damp, lerp, smoothstep, window4 } from "@/lib/math";
import { aircraftPose, cameraShot, PHASE } from "@/lib/world";
import World from "../world/World";
import { CalloutProjector } from "../overlay/Callouts";
import Atmosphere from "./Atmosphere";
import Effects from "./Effects";

function Director() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const prev = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const dt = journey.videoTime !== null ? 1 / 24 : Math.min(delta, 0.1);
    frame.delta = dt;
    if (journey.videoTime !== null) journey.time = journey.videoTime;
    else journey.time += dt;
    const p = journey.render;
    const f = journey.finaleRender;

    aircraftPose(p + f * 0.5, frame.pose);
    const s = cameraShot(p, f, frame.pose, frame.shot);

    camera.position.copy(s.position);

    // physical vibration while taxiing / rolling / climbing
    const u = clamp((p - PHASE.roll0) / (PHASE.liftoff - PHASE.roll0));
    const rolling = window4(p, PHASE.roll0, PHASE.roll0 + 0.004, PHASE.liftoff, PHASE.liftoff + 0.003);
    const taxi = window4(p, PHASE.push0, PHASE.push0 + 0.004, PHASE.lineUp - 0.003, PHASE.lineUp);
    const air = window4(p, PHASE.liftoff, PHASE.liftoff + 0.01, 0.84, 0.855);
    const activity = journey.capturing || journey.reducedMotion ? 0 : 0.35 + 0.65 * clamp(Math.abs(journey.velocity) * 40);
    const amp = (rolling * (0.002 + 0.01 * u) + taxi * 0.0025 + air * 0.0022) * activity * s.inAircraft;
    const t = journey.time;
    camera.position.x += (Math.sin(t * 37.1) + 0.6 * Math.sin(t * 61.7)) * amp;
    camera.position.y += (Math.sin(t * 43.3 + 1.2) + 0.5 * Math.sin(t * 71.9)) * amp * 1.3 + air * Math.sin(t * 2.1) * 0.012 * s.inAircraft;
    camera.position.z += Math.sin(t * 29.3 + 2.1) * amp * 0.6;

    camera.up.copy(s.up);
    camera.lookAt(s.target);

    // câmera livre de inspeção, só em desenvolvimento
    if (process.env.NODE_ENV !== "production") {
      const look = (window as unknown as { __poaLook?: { pos: [number, number, number]; alvo: [number, number, number]; fov?: number } }).__poaLook;
      if (look) {
        camera.position.set(...look.pos);
        camera.up.set(0, 1, 0);
        camera.lookAt(look.alvo[0], look.alvo[1], look.alvo[2]);
        if (look.fov && camera.fov !== look.fov) {
          camera.fov = look.fov;
          camera.updateProjectionMatrix();
        }
      }
    }

    const near = p < 0.12 ? lerp(0.6, 0.06, smoothstep(0.085, 0.108, p)) : p < 0.87 ? 0.06 : lerp(0.06, 1.5, smoothstep(0.875, 0.93, p));
    if (camera.fov !== s.fov || camera.near !== near) {
      camera.fov = s.fov;
      camera.near = near;
      camera.far = 60000;
      camera.updateProjectionMatrix();
    }
    frame.viewDir.set(0, 0, -1).applyQuaternion(camera.quaternion);

    const speed = prev.distanceTo(camera.position) / Math.max(dt, 1e-3);
    frame.camSpeed = damp(frame.camSpeed, Math.min(speed, 400), 5, dt);
    prev.copy(camera.position);
    frame.speedFeel = clamp(rolling * u * 1.1 + air * 0.35 + (s.inAircraft < 0.5 ? clamp(frame.camSpeed / 200) * 0.5 : 0));

    direct(p, f, frame.viewDir, frame.dir);
    frame.indoors = window4(p, 0.124, 0.134, 0.44, 0.452);
  }, -2);

  return null;
}

function grab(src: HTMLCanvasElement, width: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = Math.round((src.height / src.width) * width);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
}

/**
 * Gallery stills. "preload": rendered while the loader is up (also pre-compiles
 * every shader). "lazy" (safe tier): no burst of off-journey renders, each still
 * is taken from the live frame when the viewer scrolls past its moment.
 */
function StillCapture({ onDone, mode }: { onDone: () => void; mode: "preload" | "lazy" }) {
  const gl = useThree((s) => s.gl);
  const st = useRef({ i: 0, wait: 0, images: [] as string[], done: false, warm: 0, lazyReady: false });

  useFrame(() => {
    const s = st.current;
    if (mode === "lazy") {
      if (!s.lazyReady) {
        s.lazyReady = true;
        onDone();
      }
      if (!journey.ready || journey.capturing) return;
      GALLERY_SHOTS.forEach((shot, i) => {
        if (s.images[i]) return;
        const near = shot.p >= 1 ? journey.progress > 0.995 && journey.finale < 0.02 : Math.abs(journey.progress - shot.p) < 0.004;
        if (near && Math.abs(journey.velocity) < 0.01) {
          s.images[i] = grab(gl.domElement, 640);
          setGalleryImages([...s.images]);
        }
      });
      return;
    }
    if (s.done) return;
    if (journey.ready && s.warm >= 6) {
      s.done = true;
      journey.capturing = false;
      journey.render = journey.progress;
      setGalleryImages(s.images);
      onDone();
      return;
    }
    if (window.location.search.includes("nocapture")) {
      s.done = true;
      journey.capturing = false;
      onDone();
      return;
    }
    // let the first frames compile before starting
    if (s.warm < 6) {
      s.warm++;
      journey.capturing = true;
      journey.render = GALLERY_SHOTS[0].p;
      return;
    }
    const shot = GALLERY_SHOTS[s.i];
    journey.capturing = true;
    journey.render = shot.p;
    journey.finaleRender = 0;
    s.wait++;
    if (s.wait < 5) return;
    s.images.push(grab(gl.domElement, 960));
    s.i++;
    s.wait = 0;
    if (s.i >= GALLERY_SHOTS.length) {
      s.done = true;
      journey.capturing = false;
      journey.render = journey.progress;
      setGalleryImages(s.images);
      onDone();
    }
  }, 2);
  return null;
}

function PlainRender() {
  useFrame(({ gl, scene, camera }) => gl.render(scene, camera), 1);
  return null;
}

/** Safe tier: straight to the canvas with renderer tone mapping, no floating-point render targets. */
function SafeRender() {
  useFrame(({ gl, scene, camera }) => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = frame.dir.exposure * 0.95;
    gl.render(scene, camera);
  }, 1);
  return null;
}

/** If the driver drops the WebGL context, remember it and tell the page instead of dying silently. */
function ContextGuard({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      rememberSafeMode();
      onLost();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onLost]);
  return null;
}

/** Dev-only QA hook: window.__poa.shoot([{p, name, finale?}]) saves frames via /api/shot. */

function DebugShooter() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const q = useRef<{ p: number; name: string; finale?: number; wait: number; hide?: string[]; t?: number; settle?: number; w?: number }[]>([]);
  const fps = useRef({ n: 0, t: performance.now(), value: 0 });
  const inflight = useRef(0);
  if (typeof window !== "undefined") {
    const w = window as unknown as { __poa?: Record<string, unknown> };
    w.__poa = {
      ...(w.__poa ?? {}),
      journey,
      scene,
      gl,
      frame,
      fps: () => fps.current.value,
      pending: () => q.current.length + inflight.current,
      debug: () => ({
        cam: camera.position.toArray().map((v) => +v.toFixed(2)),
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
        target: frame.shot.target.toArray().map((v) => +v.toFixed(2)),
        fog: (scene.fog as unknown as { color: { getHexString: () => string } } | null)?.color.getHexString(),
        dir: { el: frame.dir.sunElevation, exp: frame.dir.exposure, sunI: frame.dir.sunIntensity, env: frame.dir.envIntensity },
        info: { calls: gl.info.render.calls, tris: gl.info.render.triangles, programs: gl.info.programs?.length, textures: gl.info.memory.textures },
        size: [gl.domElement.width, gl.domElement.height],
        badPrograms: (gl.info.programs ?? [])
          .filter((pr) => (pr as unknown as { diagnostics?: { runnable: boolean } }).diagnostics && !(pr as unknown as { diagnostics: { runnable: boolean } }).diagnostics.runnable)
          .map((pr) => {
            const d = (pr as unknown as { name: string; diagnostics: { programLog: string; vertexShader: { log: string }; fragmentShader: { log: string } } });
            return { name: d.name, program: d.diagnostics.programLog.slice(0, 300), vs: d.diagnostics.vertexShader.log.slice(0, 300), fs: d.diagnostics.fragmentShader.log.slice(0, 500) };
          }),
      }),
      shoot: (list: { p: number; name: string; finale?: number; hide?: string[]; t?: number; settle?: number; w?: number }[]) => {
        q.current.push(...list.map((x) => ({ ...x, wait: 0 })));
      },
    };
  }
  useFrame(() => {
    const f = fps.current;
    f.n++;
    const now = performance.now();
    if (now - f.t > 1000) {
      f.value = (f.n * 1000) / (now - f.t);
      f.n = 0;
      f.t = now;
    }
    const job = q.current[0];
    if (!job) return;
    journey.capturing = true;
    journey.render = job.p;
    journey.finaleRender = job.finale ?? 0;
    if (job.t !== undefined) journey.videoTime = job.t;
    if (job.wait === 0) {
      for (const name of ["w-ground", "w-airfield", "w-landside", "w-terminal", "w-crowd", "w-hero", "w-fleet", "w-city", "w-clouds"]) {
        const o = scene.getObjectByName(name);
        if (o) o.visible = !(job.hide ?? []).includes(name);
      }
    }
    job.wait++;
    if (job.wait < (job.settle ?? 8)) return;
    const src = gl.domElement;
    const c = document.createElement("canvas");
    c.width = job.w ?? 1024;
    c.height = Math.round((src.height / src.width) * c.width);
    c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
    const data = c.toDataURL("image/jpeg", 0.85);
    inflight.current++;
    fetch("/api/shot", { method: "POST", body: JSON.stringify({ name: job.name, data }) }).finally(() => inflight.current--);
    q.current.shift();
    if (!q.current.length) {
      journey.capturing = false;
      journey.videoTime = null;
    }
  }, 3);
  return null;
}

export default function Scene({ onReady, tier, onContextLost }: { onReady: () => void; tier: Tier; onContextLost: () => void }) {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const safe = tier === "safe";
  const [quality, setQuality] = useState<"high" | "medium" | "low">(safe ? "low" : tier);
  const maxDpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, tier === "high" ? 1.75 : tier === "medium" ? 1.25 : 1) : 1;
  const [dpr, setDpr] = useState(params?.get("dpr") ? Number(params.get("dpr")) : safe ? 0.75 : tier === "low" ? Math.min(maxDpr, 0.85) : maxDpr);

  return (
    <Canvas
      flat={!safe}
      shadows={safe ? false : { type: PCFShadowMap }}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: safe ? "default" : "high-performance", stencil: false, alpha: false }}
      camera={{ fov: 34, near: 0.6, far: 60000, position: [-70, 72, 250] }}
      style={{ position: "fixed", inset: 0 }}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => {
          if (!journey.ready || params?.has("q") || safe) return;
          setDpr((d) => Math.max(0.7, d - 0.2));
          setQuality((q) => (q === "high" ? "medium" : "low"));
          journey.quality = journey.quality === "high" ? "medium" : "low";
        }}
        onIncline={() => !params?.has("dpr") && setDpr((d) => Math.min(maxDpr, d + 0.2))}
      />
      <ContextGuard onLost={onContextLost} />
      <Director />
      <Atmosphere />
      <CalloutProjector />
      <Suspense fallback={null}>
        <World />
        <StillCapture onDone={onReady} mode={safe ? "lazy" : "preload"} />
      </Suspense>
      {safe ? <SafeRender /> : params?.get("fx") !== "off" ? <Effects quality={quality} /> : <PlainRender />}
      {process.env.NODE_ENV !== "production" && <DebugShooter />}
    </Canvas>
  );
}
