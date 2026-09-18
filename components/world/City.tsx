"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type WebGLProgramParametersWithUniforms } from "three";
import { frame } from "@/lib/frame";
import { hillHeight, inAirport, isWater } from "@/lib/geo";
import { journey } from "@/lib/journey";
import { mats } from "@/lib/materials";
import { mulberry32 } from "@/lib/math";
import { LANDMARKS } from "@/lib/world";
import { StaticInstances, type Xform } from "./helpers";

const DOWNTOWN = new Vector3(-6000, 0, 4550);

/**
 * Porto Alegre as ~9,000 instanced buildings. Facades get procedural window
 * grids (scaled per instance so floors stay 3.3 m tall); at dusk random
 * windows light up. Placement respects the Guaíba, the delta, the hills and
 * the airfield, with a dense high-rise core in the Centro Histórico.
 */
function Buildings() {
  const { mesh, uniforms } = useMemo(() => {
    const r = mulberry32(1923);
    const mats4: Matrix4[] = [];
    const colors: Color[] = [];
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const palette = ["#d9d3c7", "#c8c2b6", "#b9b3aa", "#e6e1d7", "#a8a39a", "#cbb9a0", "#9aa3a8", "#d4c6b3", "#b8a48c"];

    const tryPlace = (x: number, z: number, cell: number) => {
      if (isWater(x, z, 90)) return;
      if (inAirport(x, z, 160)) return;
      if (x > -700 && x < 700 && z > -150 && z < 420) return; // landside foreground is modelled separately
      const hh = hillHeight(x, z);
      if (hh > 60) return;
      const dDown = Math.hypot(x - DOWNTOWN.x, z - DOWNTOWN.z);
      const core = Math.max(0, 1 - dDown / 2300);
      const cityEdge = Math.hypot((x + 2500) * 0.8, (z - 5000) * 0.6);
      if (cityEdge > 11000) return;
      const outer = Math.min(1, cityEdge / 11000);
      if (r() < outer * 0.7) return;
      const jitter = cell * 0.35;
      const px = x + (r() - 0.5) * jitter;
      const pz = z + (r() - 0.5) * jitter;
      const fw = cell * (0.35 + r() * 0.35);
      const fd = cell * (0.35 + r() * 0.35);
      let h = 4 + r() * 10;
      if (r() < 0.25) h += r() * 25;
      h += core * (6 + Math.pow(r(), 2.2) * 85);
      if (r() < 0.015) h += 40;
      const ang = Math.sin(x * 0.00021) * 0.6 + Math.cos(z * 0.00017) * 0.4;
      q.setFromAxisAngle(up, ang);
      const m = new Matrix4().compose(new Vector3(px, hh + h / 2 - 0.5, pz), q, new Vector3(fw, h, fd));
      mats4.push(m);
      colors.push(new Color(palette[Math.floor(r() * palette.length)]).multiplyScalar(0.85 + r() * 0.2));
    };

    for (let x = -8600; x <= 9000; x += 100) {
      for (let z = -4200; z <= 13500; z += 100) {
        const d = Math.hypot(x - DOWNTOWN.x, z - DOWNTOWN.z);
        if (d < 2200) {
          for (const [ox, oz] of [
            [0, 0],
            [50, 0],
            [0, 50],
            [50, 50],
          ])
            if (r() < (journey.quality === "safe" ? 0.45 : 0.8)) tryPlace(x + ox, z + oz, 50);
        } else if (r() < (journey.quality === "safe" ? 0.3 : 0.58)) tryPlace(x, z, 100);
      }
    }

    const geo = new BoxGeometry(1, 1, 1);
    const mat = new MeshStandardMaterial({ roughness: 0.78, metalness: 0.05 });
    const uni = { uNight: { value: 0 } };
    mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uni);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vLocal;
varying vec3 vBScale;
varying vec3 vObjN;
flat varying float vId;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vBScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
vLocal = (position + 0.5) * vBScale;
vObjN = normal;
vId = float(gl_InstanceID);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uNight;
varying vec3 vLocal;
varying vec3 vBScale;
varying vec3 vObjN;
flat varying float vId;
float bHash(vec2 p){ p = fract(p*vec2(443.8975, 397.2973)); p += dot(p, p+19.19); return fract(p.x*p.y); }
float gWin; float gLit; float gRoof;`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
{
  gRoof = step(0.5, vObjN.y);
  vec2 f = abs(vObjN.x) > 0.5 ? vLocal.zy : vLocal.xy;
  vec2 g = f / vec2(3.1, 3.3);
  vec2 fw = fwidth(g);
  float lod = smoothstep(0.35, 0.9, max(fw.x, fw.y));
  vec2 c = fract(g);
  vec2 id = floor(g);
  float win = step(0.16, c.x) * step(c.x, 0.84) * step(0.28, c.y) * step(c.y, 0.82);
  win = mix(win, 0.42, lod) * (1.0 - gRoof) * step(1.0, id.y + 0.001);
  gWin = win;
  float h = bHash(id + vec2(vId * 0.137, vId * 0.071));
  gLit = step(0.52, h) * mix(1.0, 0.5, lod);
  vec3 glass = mix(vec3(0.07, 0.085, 0.1), vec3(0.2, 0.23, 0.27), h * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * 0.9);
  diffuseColor.rgb *= mix(0.92, 0.5, gRoof);
}`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.15, gWin);`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
{
  vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(0.85, 0.9, 1.0), step(0.8, bHash(vec2(vId, 3.0))));
  totalEmissiveRadiance += warm * gWin * gLit * uNight * 1.6;
}`,
        );
    };
    const im = new InstancedMesh(geo, mat, mats4.length);
    mats4.forEach((m, i) => {
      im.setMatrixAt(i, m);
      im.setColorAt(i, colors[i]);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.frustumCulled = false;
    im.receiveShadow = true;
    im.castShadow = false;
    return { mesh: im, uniforms: uni };
  }, []);

  useFrame(() => {
    uniforms.uNight.value = frame.dir.night;
  });

  return <primitive object={mesh} />;
}

function Gasometro() {
  const brick = useMemo(() => new MeshStandardMaterial({ color: "#8a4a36", roughness: 0.9 }), []);
  const p = LANDMARKS.gasometro;
  return (
    <group position={[p.x, 0, p.z]} rotation-y={0.35}>
      <mesh position={[0, 12, 0]} material={brick} castShadow>
        <boxGeometry args={[90, 24, 34]} />
      </mesh>
      <mesh position={[0, 25, 0]} material={mats().darkConcrete}>
        <boxGeometry args={[92, 2, 36]} />
      </mesh>
      <mesh position={[52, 58, 0]} material={brick} castShadow>
        <cylinderGeometry args={[3.2, 5.4, 117, 16]} />
      </mesh>
      <mesh position={[52, 117, 0]} material={mats().graphite}>
        <cylinderGeometry args={[3.6, 3.4, 2, 16]} />
      </mesh>
    </group>
  );
}

function BeiraRio() {
  const p = LANDMARKS.beiraRio;
  const petals = useMemo(() => {
    const items: Xform[] = [];
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rx = 128;
      const rz = 105;
      items.push({ p: [Math.cos(a) * rx, 32, Math.sin(a) * rz], r: [0, -a, 0.35], s: [34, 1.2, 11] });
    }
    return items;
  }, []);
  const petalGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const white = useMemo(() => new MeshStandardMaterial({ color: "#f4f4f2", roughness: 0.4, emissive: new Color("#ffffff"), emissiveIntensity: 0 }), []);
  const red = useMemo(() => new MeshStandardMaterial({ color: "#b3121f", roughness: 0.6 }), []);
  useFrame(() => {
    white.emissiveIntensity = frame.dir.night * 0.5;
  });
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh position={[0, 12, 0]} scale={[1.22, 1, 1]} material={red}>
        <cylinderGeometry args={[105, 112, 24, 48, 1, true]} />
      </mesh>
      <mesh position={[0, 0.6, 0]} scale={[1.2, 1, 1]}>
        <cylinderGeometry args={[70, 70, 1, 40]} />
        <meshStandardMaterial color="#3f7a35" roughness={1} />
      </mesh>
      <StaticInstances geometry={petalGeo} material={white} items={petals} />
      <mesh position={[0, 24, 0]} rotation-x={Math.PI / 2} scale={[1.22, 1, 1]} material={white}>
        <torusGeometry args={[108, 3, 6, 48]} />
      </mesh>
    </group>
  );
}

function ArenaGremio() {
  const p = LANDMARKS.arenaGremio;
  return (
    <group position={[p.x, 0, p.z]} rotation-y={0.2}>
      <mesh position={[0, 17, 0]} castShadow>
        <boxGeometry args={[230, 34, 180]} />
        <meshStandardMaterial color="#5f6b78" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 34.3, 0]}>
        <boxGeometry args={[150, 0.6, 100]} />
        <meshStandardMaterial color="#2f6a2d" roughness={1} />
      </mesh>
      <mesh position={[0, 30, 0]}>
        <boxGeometry args={[236, 3, 186]} />
        <meshStandardMaterial color="#1b6fb3" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Cathedral() {
  return (
    <group position={[-5650, 0, 4390]}>
      <mesh position={[0, 16, 0]} material={mats().offWhite} castShadow>
        <boxGeometry args={[36, 32, 70]} />
      </mesh>
      <mesh position={[0, 44, 8]} material={mats().offWhite}>
        <cylinderGeometry args={[10, 12, 16, 20]} />
      </mesh>
      <mesh position={[0, 52, 8]}>
        <sphereGeometry args={[11, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#5f8a86" roughness={0.4} metalness={0.4} />
      </mesh>
      {[-12, 12].map((x) => (
        <mesh key={x} position={[x, 30, -38]} material={mats().offWhite} castShadow>
          <boxGeometry args={[8, 60, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function GuaibaBridge() {
  const p = LANDMARKS.guaibaBridge;
  const piers = useMemo(() => {
    const it: Xform[] = [];
    for (let x = -700; x <= 700; x += 50) it.push({ p: [x, 6, 0], s: [4, 12, 14] });
    return it;
  }, []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  return (
    <group position={[p.x, 0, p.z]} rotation-y={-0.15}>
      <StaticInstances geometry={box} material={mats().concrete} items={piers} />
      <mesh position={[0, 12.5, 0]} material={mats().concrete} castShadow>
        <boxGeometry args={[1440, 1.5, 16]} />
      </mesh>
      {[-45, 45].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-9, 9].map((z) => (
            <mesh key={z} position={[0, 30, z]} material={mats().steel} castShadow>
              <boxGeometry args={[5, 60, 3]} />
            </mesh>
          ))}
          <mesh position={[0, 58, 0]} material={mats().steel}>
            <boxGeometry args={[6, 5, 21]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 22, 0]} material={mats().safetyOrange}>
        <boxGeometry args={[84, 4, 17]} />
      </mesh>
    </group>
  );
}

export default function City() {
  const group = useRef<Group>(null);
  useFrame(() => {
    const p = journey.render;
    // hidden while we are inside the terminal (it would only cost fill rate)
    if (group.current) group.current.visible = !(p > 0.125 && p < 0.44);
  });
  return (
    <group ref={group}>
      <Buildings />
      <Gasometro />
      <BeiraRio />
      <ArenaGremio />
      <Cathedral />
      <GuaibaBridge />
    </group>
  );
}
