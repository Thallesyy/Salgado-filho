"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from "three";
import { frame } from "@/lib/frame";
import { journey } from "@/lib/journey";

export type LightSpec = { pos: [number, number, number]; color: [number, number, number]; size?: number; blink?: number };

/**
 * Thousands of point lights (runway edge, approach, taxiway, apron masts, windows)
 * rendered as HDR sprites in one draw call. Size is in metres with a minimum
 * on-screen footprint so distant lights never shimmer away; bloom does the rest.
 */
export default function LightPoints({ lights, day = 0.15, night = 1, minPx = 1.6 }: { lights: LightSpec[]; day?: number; night?: number; minPx?: number }) {
  const points = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const size: number[] = [];
    const blink: number[] = [];
    for (const l of lights) {
      pos.push(...l.pos);
      col.push(...l.color);
      size.push(l.size ?? 0.6);
      blink.push(l.blink ?? 0);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(col, 3));
    g.setAttribute("size", new Float32BufferAttribute(size, 1));
    g.setAttribute("blink", new Float32BufferAttribute(blink, 1));
    g.computeBoundingSphere();
    const m = new ShaderMaterial({
      uniforms: {
        uIntensity: { value: 1 },
        uScale: { value: 800 },
        uMinPx: { value: minPx },
        uTime: { value: 0 },
        uFogDensity: { value: 0.0001 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float size;
        attribute float blink;
        uniform float uScale;
        uniform float uMinPx;
        uniform float uTime;
        uniform float uFogDensity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = -mv.z;
          float px = size * uScale / max(dist, 0.1);
          float b = blink > 0.0 ? step(0.82, fract(uTime * blink + position.x * 0.013)) : 1.0;
          vAlpha = clamp(px / uMinPx, 0.15, 1.0) * b;
          gl_PointSize = max(px, uMinPx) * 2.5;
          float fogF = exp(-pow(dist * uFogDensity * 0.55, 2.0));
          vColor = color * fogF;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIntensity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float core = smoothstep(0.2, 0.0, d);
          float halo = smoothstep(0.5, 0.0, d) * 0.35;
          float a = (core + halo) * vAlpha;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vColor * uIntensity * a, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = 5;
    return p;
  }, [lights, minPx]);

  useFrame((state) => {
    const u = (points.material as ShaderMaterial).uniforms;
    const d = frame.dir;
    u.uIntensity.value = day + (night - day) * d.night + 0.25 * (1 - d.sunIntensity / 3.4);
    // pixels per metre at 1 m for the current FOV and drawing-buffer height
    const cam = state.camera as unknown as { fov: number };
    u.uScale.value = state.gl.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    u.uTime.value = journey.time;
    u.uFogDensity.value = d.fogDensity;
  });

  return <primitive object={points} />;
}
