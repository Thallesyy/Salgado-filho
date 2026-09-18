"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode, type BloomEffect, type DepthOfFieldEffect } from "postprocessing";
import { useMemo, useRef } from "react";
import type { PerspectiveCamera } from "three";
import { frame } from "@/lib/frame";
import { journey } from "@/lib/journey";
import { clamp, smoothstep } from "@/lib/math";
import { AmbientOcclusionEffect, ExposureEffect, FilmEffect, MotionBlurEffect, SanitizeEffect } from "./effects";

export default function Effects({ quality }: { quality: "high" | "medium" | "low" }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const motion = useMemo(() => new MotionBlurEffect(), []);
  const exposure = useMemo(() => new ExposureEffect(), []);
  const film = useMemo(() => new FilmEffect(), []);
  const sanitize = useMemo(() => new SanitizeEffect(), []);
  const ao = useMemo(() => new AmbientOcclusionEffect(quality === "high" ? 14 : 10), [quality]);
  const bloom = useRef<BloomEffect>(null);
  const dof = useRef<DepthOfFieldEffect>(null);
  motion.camera = camera;
  ao.camera = camera;

  useFrame(() => {
    const d = frame.dir;
    const p = journey.render;
    exposure.exposure = d.exposure;
    film.set("uSaturation", d.saturation);
    film.set("uContrast", d.contrast);
    film.set("uVignette", d.vignette);
    film.set("uGrain", d.grain);
    film.set("uLetterbox", d.letterbox);
    film.set("uWarmth", 0.3 + 0.7 * smoothstep(20, 0, d.sunElevation));
    if (bloom.current) {
      bloom.current.intensity = d.bloom;
      // daylight surfaces exceed 1.0 in HDR: raise the threshold by day so only practicals glow
      bloom.current.luminanceMaterial.threshold = 1.5 - 0.75 * d.night - 0.35 * d.interior;
    }

    // oclusão: mais forte dentro do terminal, onde quase toda a luz é indireta;
    // desligada em voo, quando não há nada perto o bastante para fazer sombra de contato
    const alto = smoothstep(120, 260, camera.position.y);
    ao.intensity = (0.5 + 0.4 * d.interior) * (1 - alto);
    ao.radius = 1.0 + 0.3 * (1 - d.interior);
    if (process.env.NODE_ENV !== "production") ao.debug = !!(window as unknown as { __poaAO?: boolean }).__poaAO;

    // blur: stronger while the aircraft is fast, attach cabin geometry to camera
    // gravação de vídeo quadro a quadro mantém o desfoque, com obturador de 24 quadros
    const video = journey.videoTime !== null;
    const still = journey.capturing && !video;
    motion.strength = still || journey.reducedMotion ? 0 : 0.55 + 0.35 * frame.speedFeel;
    motion.attached = frame.shot.inAircraft > 0.5 ? 14 : 0;
    motion.ca = still ? 0 : 0.0012 * frame.speedFeel + 0.0004;
    motion.fixedDelta = video ? 1 / 24 : 0;
    if (still) motion.reset();

    const f = dof.current;
    if (f) {
      const focus = frame.shot.focus;
      f.cocMaterial.focusDistance = focus;
      f.cocMaterial.focusRange = clamp(focus * 0.9, 2.5, 4000);
      f.cocMaterial.uniforms.cameraNear.value = camera.near;
      f.cocMaterial.uniforms.cameraFar.value = camera.far;
      f.bokehScale = d.bokeh * (p > 0.92 ? 0.6 : 1);
    }
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false} stencilBuffer={false}>
      <primitive object={sanitize} dispose={null} />
      {/* logo depois da limpeza, no mesmo passe: escurece a luz da cena antes de qualquer desfoque */}
      {quality !== "low" ? <primitive object={ao} dispose={null} /> : <></>}
      {quality === "high" ? (
        <DepthOfField ref={dof} focusDistance={10} focusRange={8} bokehScale={2} resolutionScale={0.5} />
      ) : (
        <></>
      )}
      {quality !== "low" ? <primitive object={motion} dispose={null} /> : <></>}
      <Bloom ref={bloom} mipmapBlur intensity={0.5} luminanceThreshold={1.0} luminanceSmoothing={0.3} radius={0.72} />
      <primitive object={exposure} dispose={null} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <primitive object={film} dispose={null} />
    </EffectComposer>
  );
}
