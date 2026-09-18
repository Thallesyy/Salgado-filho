"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Euler, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type Material, type BufferGeometry } from "three";
import { journey } from "@/lib/journey";
import type { Xform } from "./helpers";

/**
 * Objetos de cena vindos de modelos 3D com licença CC0 (Poly Haven).
 * Cada modelo é lido uma vez e transformado em malhas instanciadas: quantas
 * cópias houver, o custo de desenho continua sendo o número de partes do modelo.
 */
export const MODELO = {
  banco: "/modelos/modular_street_seating/modular_street_seating.gltf",
  planta: "/modelos/pachira_aquatica_01/pachira_aquatica_01.gltf",
  plantaBaixa: "/modelos/anthurium_botany_01/anthurium_botany_01.gltf",
  lixeira: "/modelos/metal_trash_can/metal_trash_can.gltf",
  placaPiso: "/modelos/WetFloorSign_01/WetFloorSign_01.gltf",
  carrinhoCafe: "/modelos/CoffeeCart_01/CoffeeCart_01.gltf",
  mesaCadeiras: "/modelos/outdoor_table_chair_set_01/outdoor_table_chair_set_01.gltf",
  extintor: "/modelos/korean_fire_extinguisher_01/korean_fire_extinguisher_01.gltf",
  relogio: "/modelos/wall_clock/wall_clock.gltf",
  carrinho: "/modelos/industrial_storage_cart/industrial_storage_cart.gltf",
} as const;

const _m = new Matrix4();
const _local = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

/** Espalha um modelo glTF em várias posições usando malhas instanciadas. */
export function InstancedModel({ url, items, shadows = true }: { url: string; items: Xform[]; shadows?: boolean }) {
  const { scene } = useGLTF(url);
  const meshes = useMemo(() => {
    if (!items.length) return [];
    scene.updateMatrixWorld(true);
    const parts: { geo: BufferGeometry; mat: Material | Material[]; local: Matrix4 }[] = [];
    scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, local: m.matrixWorld.clone() });
    });
    return parts.map(({ geo, mat, local }) => {
      const im = new InstancedMesh(geo, mat as Material, items.length);
      items.forEach((it, i) => {
        _q.setFromEuler(_e.set(...(it.r ?? [0, 0, 0])));
        _m.compose(_p.set(...it.p), _q, _s.set(...(it.s ?? [1, 1, 1])));
        _local.copy(_m).multiply(local);
        im.setMatrixAt(i, _local);
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = shadows;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      return im;
    });
  }, [scene, items, shadows]);

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

/** Menos cópias em placas fracas, para o cenário continuar leve. */
export const porQualidade = <T,>(lista: T[], fracaoSegura = 0.4): T[] =>
  journey.quality === "safe" ? lista.filter((_, i) => i % Math.max(2, Math.round(1 / fracaoSegura)) === 0) : lista;

Object.values(MODELO).forEach((u) => useGLTF.preload(u));
