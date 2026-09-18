"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { Color, MeshStandardMaterial, PlaneGeometry, type WebGLProgramParametersWithUniforms } from "three";
import { frame } from "@/lib/frame";
import { GLSL_GEO } from "@/lib/geo";
import { journey } from "@/lib/journey";

/**
 * One continuous terrain for the whole film: the airfield's grass, Porto
 * Alegre's street grid, the delta islands and the Guaíba. Albedo, water
 * roughness, wave normals and night-time street lighting are procedural,
 * layered on top of MeshStandardMaterial so it receives sun, shadows, fog
 * and environment reflections like everything else.
 */
export default function Ground() {
  const { geometry, material } = useMemo(() => {
    const g = new PlaneGeometry(56000, 56000, 256, 256);
    g.rotateX(-Math.PI / 2);
    g.translate(-3000, 0, 4000);

    const m = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, metalness: 0 });
    const uniforms = { uNight: { value: 0 }, uTime: { value: 0 }, uSkyTint: { value: new Color() } };
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vWPos;
${GLSL_GEO}`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
{
  vec2 wp = (modelMatrix * vec4(transformed, 1.0)).xz;
  float water = geoWater(wp);
  float apt = geoAirport(wp);
  transformed.y += geoHill(wp) * (1.0 - water) * (1.0 - apt) - water * 1.2 - 0.02;
}`,
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uNight;
uniform float uTime;
uniform vec3 uSkyTint;
varying vec3 vWPos;
float gWater; float gLights; float gAirport; float gFw;
${GLSL_GEO}

vec3 urban(vec2 w, float fw, out float lights) {
  float ang = (geoNoise(w / 5200.0) - 0.5) * 1.6;
  float c = cos(ang), s = sin(ang);
  vec2 q = mat2(c, -s, s, c) * w;
  vec2 cell = vec2(96.0, 72.0);
  vec2 g = q / cell;
  vec2 f = fract(g);
  vec2 id = floor(g);
  vec2 dm = min(f, 1.0 - f) * cell;
  float d = min(dm.x, dm.y);
  float aa = fw * 1.2 + 0.4;
  float street = 1.0 - smoothstep(5.5 - aa, 5.5 + aa, d);
  vec2 lot = floor(q / 13.0);
  float r = geoH21(lot + id * 3.1);
  vec3 roof = mix(vec3(0.3, 0.295, 0.29), vec3(0.42, 0.27, 0.21), step(0.68, r));
  roof = mix(roof, vec3(0.44, 0.44, 0.42), step(0.92, geoH21(lot * 1.3 + 2.0)));
  roof *= 0.72 + 0.45 * geoH21(lot * 1.7);
  float tree = smoothstep(0.58, 0.8, geoNoise(w / 30.0 + id * 1.7));
  vec3 col = mix(roof, vec3(0.13, 0.19, 0.09), tree * 0.75);
  col = mix(col, vec3(0.16, 0.16, 0.17), street);
  float lod = smoothstep(3.0, 26.0, fw);
  col = mix(col, vec3(0.24, 0.235, 0.22), lod);
  float core = 1.0 - smoothstep(0.0, 1.4 + aa, d);
  float blockLit = step(0.28, geoH21(id * 1.31 + 5.0));
  float along = fract((q.x * 0.7 + q.y) / (26.0 + 14.0 * geoH21(id)));
  float lamp = core * (1.0 - smoothstep(0.05, 0.14, abs(along - 0.5))) * blockLit * (0.5 + 0.8 * geoH21(floor(q / 30.0)));
  float big = (1.0 - smoothstep(0.0, 3.0 + fw * 0.6, min(abs(fract(q.x / 480.0) - 0.5) * 480.0, abs(fract(q.y / 520.0) - 0.5) * 520.0))) * (0.6 + 0.4 * geoNoise(q / 90.0));
  float glow = (0.02 + 0.05 * geoNoise(w / 700.0) * geoNoise(w / 170.0 + 3.0)) * (0.6 + 0.8 * geoH21(id));
  lights = mix(lamp + big * 0.3, glow + big * 0.07, lod);
  return col;
}
`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
{
  vec2 w = vWPos.xz;
  float fw = length(fwidth(w));
  gFw = fw;
  gWater = geoWater(w);
  gAirport = geoAirport(w);

  // city density: dense core, parks, rural edges
  float city = smoothstep(16000.0, 9000.0, length((w - vec2(-2500.0, 5000.0)) * vec2(0.8, 0.6)));
  city *= smoothstep(0.28, 0.42, geoNoise(w / 1900.0 + 3.0));
  city *= 1.0 - smoothstep(60.0, 180.0, geoHill(w));
  float lights;
  vec3 u = urban(w, fw, lights);

  float n = geoFbm(w / 180.0);
  vec3 nature = mix(vec3(0.21, 0.27, 0.13), vec3(0.33, 0.33, 0.2), n);
  nature = mix(nature, vec3(0.12, 0.2, 0.09), smoothstep(0.55, 0.7, geoNoise(w / 60.0)));
  vec3 land = mix(nature, u, city);

  // airport grass with mowing stripes
  float stripe = step(0.5, fract(w.x / 36.0));
  vec3 grass = mix(vec3(0.27, 0.36, 0.16), vec3(0.31, 0.4, 0.19), stripe * (1.0 - smoothstep(2.0, 10.0, fw)));
  grass *= 0.85 + 0.3 * geoNoise(w / 25.0);
  land = mix(land, grass, gAirport);

  // wet banks
  vec3 waterCol = vec3(0.1, 0.105, 0.085);
  float bank = smoothstep(0.0, 0.5, gWater) * (1.0 - smoothstep(0.5, 1.0, gWater));
  land = mix(land, vec3(0.28, 0.25, 0.19), bank);

  diffuseColor.rgb = mix(land, waterCol, smoothstep(0.5, 0.95, gWater));
  gLights = lights * city * (1.0 - gAirport) * (1.0 - gWater);
}`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.12, smoothstep(0.6, 0.95, gWater));`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
if (gWater > 0.5) {
  vec2 w = vWPos.xz;
  float t = uTime;
  float e = 2.0;
  float h0 = geoNoise(w / 18.0 + vec2(t * 0.05, t * 0.03)) + 0.5 * geoNoise(w / 7.0 - vec2(t * 0.09, 0.0));
  float hx = geoNoise((w + vec2(e, 0.0)) / 18.0 + vec2(t * 0.05, t * 0.03)) + 0.5 * geoNoise((w + vec2(e, 0.0)) / 7.0 - vec2(t * 0.09, 0.0));
  float hz = geoNoise((w + vec2(0.0, e)) / 18.0 + vec2(t * 0.05, t * 0.03)) + 0.5 * geoNoise((w + vec2(0.0, e)) / 7.0 - vec2(t * 0.09, 0.0));
  // fade ripples out with distance so far water doesn't sparkle with aliasing
  vec3 pert = vec3(h0 - hx, 0.0, h0 - hz) * 0.35 * (1.0 - smoothstep(1.5, 12.0, gFw));
  normal = normalize(normal + (viewMatrix * vec4(pert, 0.0)).xyz * smoothstep(0.6, 0.95, gWater));
}`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
{
  vec3 sodium = vec3(1.0, 0.55, 0.22);
  vec3 led = vec3(0.9, 0.92, 1.0);
  vec3 lc = mix(sodium, led, geoNoise(vWPos.xz / 900.0));
  totalEmissiveRadiance += lc * gLights * uNight * 3.0;
  // the Guaíba mirrors the sky: a soft tint so open water never reads as a hole
  float wm = smoothstep(0.6, 0.95, gWater);
  vec3 Vw = normalize(vViewPosition);
  float fres = 0.18 + 0.82 * pow(1.0 - clamp(abs(dot(-Vw, normal)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += uSkyTint * wm * fres * 0.55;
}`,
        );
    };
    m.userData.uniforms = uniforms;
    return { geometry: g, material: m };
  }, []);

  useFrame(() => {
    const u = material.userData.uniforms;
    u.uNight.value = frame.dir.night;
    u.uTime.value = journey.time;
    u.uSkyTint.value.copy(frame.dir.fogColor);
  });

  return <mesh geometry={geometry} material={material} receiveShadow frustumCulled={false} />;
}
