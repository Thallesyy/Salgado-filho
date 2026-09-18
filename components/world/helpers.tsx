"use client";

import { useMemo } from "react";
import {
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

export type Xform = { p: [number, number, number]; r?: [number, number, number]; s?: [number, number, number]; q?: Quaternion };

const _up = new Vector3(0, 1, 0);
/** Transform for a unit-height, Y-aligned primitive stretched between two points. */
export function between(a: [number, number, number], b: [number, number, number], thickness: number): Xform {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  return {
    p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    q: new Quaternion().setFromUnitVectors(_up, d.normalize()),
    s: [thickness, len, thickness],
  };
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _v = new Vector3();
const _s = new Vector3();

/** Static instanced mesh: matrices are written once. */
export function StaticInstances({
  geometry,
  material,
  items,
  castShadow = false,
  receiveShadow = true,
}: {
  geometry: BufferGeometry;
  material: Material;
  items: Xform[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const mesh = useMemo(() => {
    const im = new InstancedMesh(geometry, material, Math.max(1, items.length));
    items.forEach((it, i) => {
      if (it.q) _q.copy(it.q);
      else _q.setFromEuler(_e.set(...(it.r ?? [0, 0, 0])));
      _m.compose(_v.set(...it.p), _q, _s.set(...(it.s ?? [1, 1, 1])));
      im.setMatrixAt(i, _m);
    });
    im.count = items.length;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = castShadow;
    im.receiveShadow = receiveShadow;
    return im;
  }, [geometry, material, items, castShadow, receiveShadow]);
  return <primitive object={mesh} />;
}

/**
 * Polished stone floor with live planar reflections.
 * three's Reflector renders the mirrored view only when it is itself drawn
 * (so it costs nothing while the terminal is hidden); its colour output is
 * masked and the texture is sampled by a lit PBR floor with a roughness blur.
 */
export function ReflectiveFloor({
  size,
  position,
  map,
  wear,
  strength = 0.55,
  resolution = 768,
}: {
  size: [number, number];
  position: [number, number, number];
  map: Texture;
  /** mapa de rugosidade esticado uma vez sobre o piso inteiro */
  wear?: Texture;
  strength?: number;
  resolution?: number;
}) {
  const { reflector, material, geometry } = useMemo(() => {
    const geo = new PlaneGeometry(size[0], size[1]);
    const r = new Reflector(geo, { textureWidth: resolution, textureHeight: resolution, clipBias: 0.003, multisample: 0 });
    const rm = r.material as ShaderMaterial;
    rm.colorWrite = false;
    rm.depthWrite = false;
    r.rotation.x = -Math.PI / 2;
    r.position.set(position[0], position[1] + 0.012, position[2]);
    r.renderOrder = -1;

    const tex = map.clone();
    tex.repeat.set(size[0] / 9.6, size[1] / 9.6);
    tex.needsUpdate = true;
    const m = new MeshStandardMaterial({ map: tex, roughness: wear ? 0.3 : 0.16, roughnessMap: wear ?? null, metalness: 0 });
    const uniforms = {
      tReflect: { value: r.getRenderTarget().texture },
      uTexMatrix: rm.uniforms.textureMatrix,
      uStrength: { value: strength },
      uTexel: { value: 1 / resolution },
    };
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform mat4 uTexMatrix;\nvarying vec4 vReflUv;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvReflUv = uTexMatrix * vec4(position, 1.0);");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D tReflect;\nuniform float uStrength;\nuniform float uTexel;\nvarying vec4 vReflUv;")
        .replace(
          "#include <opaque_fragment>",
          `{
  vec2 ruv = vReflUv.xy / vReflUv.w;
  float spread = uTexel * 3.0;
  vec3 refl = texture2D(tReflect, ruv).rgb * 0.36;
  refl += texture2D(tReflect, ruv + vec2(spread, 0.0)).rgb * 0.16;
  refl += texture2D(tReflect, ruv - vec2(spread, 0.0)).rgb * 0.16;
  refl += texture2D(tReflect, ruv + vec2(0.0, spread * 2.0)).rgb * 0.16;
  refl += texture2D(tReflect, ruv - vec2(0.0, spread * 2.0)).rgb * 0.16;
  vec3 V = normalize(vViewPosition);
  float fres = 0.12 + 0.88 * pow(1.0 - clamp(dot(-V, normal), 0.0, 1.0), 4.0);
  // onde o piso está fosco de poeira e marca de sapato, o reflexo some junto
  float polido = mix(0.3, 1.0, smoothstep(0.45, 0.1, roughnessFactor));
  outgoingLight += refl * uStrength * fres * polido;
}
#include <opaque_fragment>`,
        );
    };
    return { reflector: r, material: m, geometry: geo };
  }, [size, position, map, wear, strength, resolution]);

  return (
    <group>
      <primitive object={reflector} />
      <mesh geometry={geometry} material={material} position={position} rotation-x={-Math.PI / 2} receiveShadow />
    </group>
  );
}
