"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { frame } from "@/lib/frame";
import { journey } from "@/lib/journey";
import { mats } from "@/lib/materials";
import { mulberry32 } from "@/lib/math";
import { aplicarPbr, PBR, usePbr } from "@/lib/pbr";
import { roadTexture } from "@/lib/textures";
import { FACADE_Z, FLOOR } from "@/lib/world";
import { StaticInstances, type Xform } from "./helpers";
import LightPoints, { type LightSpec } from "./LightPoints";

type Lane = { x0: number; x1: number; z: number; y: number; dir: 1 | -1; speed: number; count: number; kind: "mixed" | "taxi" | "bus" };

const LANES: Lane[] = [
  // departures viaduct (westbound), taxi & drop-off lane at the kerb
  { x0: -260, x1: 260, z: 26.2, y: FLOOR, dir: -1, speed: 3.2, count: 9, kind: "taxi" },
  { x0: -260, x1: 260, z: 29.6, y: FLOOR, dir: -1, speed: 9, count: 8, kind: "mixed" },
  { x0: -260, x1: 260, z: 33.2, y: FLOOR, dir: -1, speed: 12, count: 7, kind: "mixed" },
  // arrivals / ground level
  { x0: -700, x1: 700, z: 52.5, y: 0, dir: 1, speed: 13, count: 16, kind: "mixed" },
  { x0: -700, x1: 700, z: 56, y: 0, dir: 1, speed: 15, count: 14, kind: "mixed" },
  { x0: -700, x1: 700, z: 61.5, y: 0, dir: -1, speed: 14, count: 16, kind: "mixed" },
  { x0: -700, x1: 700, z: 65, y: 0, dir: -1, speed: 11, count: 6, kind: "bus" },
];

const CAR_COLORS = ["#e9e9e7", "#c7c9cc", "#2b2d31", "#8e949b", "#5a6a82", "#7a2a2a", "#d8d2c4", "#1d3557", "#44484e"];

function Traffic() {
  const cars = useMemo(() => {
    const list: { lane: Lane; offset: number; color: string; len: number; w: number; h: number; taxi: boolean; bus: boolean }[] = [];
    const r = mulberry32(404);
    for (const lane of LANES) {
      for (let i = 0; i < lane.count; i++) {
        const bus = lane.kind === "bus";
        const taxi = lane.kind === "taxi" || (lane.kind === "mixed" && r() < 0.14);
        list.push({
          lane,
          offset: (i + r() * 0.6) / lane.count,
          color: bus ? "#dfe3e6" : taxi ? "#c8201f" : CAR_COLORS[Math.floor(r() * CAR_COLORS.length)],
          len: bus ? 12 : 4.2 + r() * 0.6,
          w: bus ? 2.55 : 1.8,
          h: bus ? 3.1 : 1.45,
          taxi,
          bus,
        });
      }
    }
    return list;
  }, []);

  const meshes = useMemo(() => {
    const n = cars.length;
    const body = new InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.12), new MeshStandardMaterial({ roughness: 0.25, metalness: 0.55 }), n);
    const glass = new InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), new MeshStandardMaterial({ color: "#0e1319", roughness: 0.05, metalness: 0.8 }), n);
    const wheels = new InstancedMesh(new CylinderGeometry(0.33, 0.33, 0.24, 12).rotateZ(Math.PI / 2), mats().rubber, n * 4);
    const head = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: new Color(4, 3.8, 3.4), toneMapped: false }), n * 2);
    const tail = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: new Color(3.5, 0.15, 0.1), toneMapped: false }), n * 2);
    const c = new Color();
    cars.forEach((car, i) => body.setColorAt(i, c.set(car.color)));
    for (const im of [body, glass, wheels, head, tail]) {
      im.frustumCulled = false;
      im.castShadow = im !== head && im !== tail;
      im.receiveShadow = true;
    }
    return { body, glass, wheels, head, tail };
  }, [cars]);

  const dummy = useMemo(() => new Object3D(), []);
  const group = useRef<Group>(null);

  useFrame(() => {
    const p = journey.render;
    const vis = p < 0.16 || p > 0.86 || journey.finaleRender > 0;
    if (group.current) group.current.visible = vis;
    if (!vis) return;
    const t = journey.time;
    const night = frame.dir.night;
    (meshes.head.material as MeshBasicMaterial).color.setRGB(4 * (0.15 + night), 3.8 * (0.15 + night), 3.4 * (0.15 + night));

    // crossing: while the camera walks over the viaduct, westbound cars queue east of the zebra
    const stop = p > 0.07 && p < 0.14;
    const xs = new Float32Array(cars.length);
    cars.forEach((car, i) => {
      const L = car.lane;
      const span = L.x1 - L.x0;
      const u = (car.offset + (t * L.speed) / span) % 1;
      xs[i] = L.dir > 0 ? L.x0 + u * span : L.x1 - u * span;
    });
    if (stop) {
      for (const lane of LANES) {
        if (lane.y !== FLOOR) continue;
        const idx = cars.map((c, i) => (c.lane === lane ? i : -1)).filter((i) => i >= 0 && xs[i] > -4);
        idx.sort((a, b) => xs[a] - xs[b]);
        let front = 6;
        for (const i of idx) {
          const half = cars[i].len / 2;
          const x = Math.max(xs[i], front + half);
          xs[i] = x;
          front = x + half + 1.8;
        }
      }
    }

    cars.forEach((car, i) => {
      const L = car.lane;
      const x = xs[i];
      const yaw = L.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const base = L.y;
      const put = (im: InstancedMesh, idx: number, px: number, py: number, pz: number, sx: number, sy: number, sz: number) => {
        // local (along, up, across) → world
        const ax = L.dir * px;
        const az = L.dir * pz;
        dummy.position.set(x + ax, base + py, L.z - az);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        im.setMatrixAt(idx, dummy.matrix);
      };
      const hb = car.bus ? car.h : car.h * 0.55;
      put(meshes.body, i, 0, 0.35 + hb / 2, 0, car.w, hb, car.len);
      if (car.bus) put(meshes.glass, i, 0, 0.35 + car.h * 0.62, 0, car.w + 0.02, car.h * 0.36, car.len * 0.96);
      else put(meshes.glass, i, -0.2, 0.35 + hb + 0.28, 0, car.w * 0.88, 0.55, car.len * 0.52);
      const wx = car.w / 2 - 0.05;
      const wz = car.len / 2 - (car.bus ? 2 : 0.8);
      put(meshes.wheels, i * 4, wz, 0.33, wx, 1, 1, 1);
      put(meshes.wheels, i * 4 + 1, wz, 0.33, -wx, 1, 1, 1);
      put(meshes.wheels, i * 4 + 2, -wz, 0.33, wx, 1, 1, 1);
      put(meshes.wheels, i * 4 + 3, -wz, 0.33, -wx, 1, 1, 1);
      for (const s of [-1, 1]) {
        put(meshes.head, i * 2 + (s > 0 ? 1 : 0), car.len / 2 + 0.01, 0.35 + hb * 0.6, s * (car.w / 2 - 0.3), 0.35, 0.12, 0.04);
        put(meshes.tail, i * 2 + (s > 0 ? 1 : 0), -car.len / 2 - 0.01, 0.35 + hb * 0.6, s * (car.w / 2 - 0.3), 0.35, 0.12, 0.04);
      }
    });
    for (const im of Object.values(meshes)) im.instanceMatrix.needsUpdate = true;
  });

  // note: body/glass/wheels/head/tail use local axes rotated by yaw, so "along" maps onto the lane
  return (
    <group ref={group}>
      {Object.values(meshes).map((im, i) => (
        <primitive key={i} object={im} />
      ))}
    </group>
  );
}

function Trees({ items }: { items: Xform[] }) {
  const trunk = useMemo(() => new CylinderGeometry(0.14, 0.22, 1, 6), []);
  const crown = useMemo(() => new IcosahedronGeometry(1, 1), []);
  const crownMat = useMemo(() => new MeshStandardMaterial({ color: "#3f5a2e", roughness: 1, flatShading: true }), []);
  const trunks = useMemo(() => items.map((t) => ({ p: [t.p[0], t.p[1] + 1.4 * (t.s?.[1] ?? 1), t.p[2]] as [number, number, number], s: [1, 2.8 * (t.s?.[1] ?? 1), 1] as [number, number, number] })), [items]);
  const crowns = useMemo(
    () => items.map((t) => ({ p: [t.p[0], t.p[1] + 4 * (t.s?.[1] ?? 1), t.p[2]] as [number, number, number], s: [2.4 * (t.s?.[0] ?? 1), 2 * (t.s?.[1] ?? 1), 2.4 * (t.s?.[0] ?? 1)] as [number, number, number] })),
    [items],
  );
  return (
    <group>
      <StaticInstances geometry={trunk} material={mats().trunk} items={trunks} castShadow />
      <StaticInstances geometry={crown} material={crownMat} items={crowns} castShadow />
    </group>
  );
}

/** Cópia da textura com repetição própria, para não esticar a faixa ao longo da avenida. */
function repetir(t: Texture, rx: number, ry: number) {
  const c = t.clone();
  c.wrapS = c.wrapT = RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
}

export default function Landside() {
  const m = mats();
  const road = roadTexture();
  // superfícies grandes ganham relevo próprio, medido em metros e não na malha
  const asfaltoEmbarque = usePbr(PBR.asfalto, [520 / 5, 14 / 5]);
  const asfaltoAvenida = usePbr(PBR.asfalto, [1400 / 5, 16 / 5]);
  const asfaltoAcesso = usePbr(PBR.asfalto, [16 / 5, 820 / 5]);
  const asfaltoPatio = usePbr(PBR.asfalto, [370 / 5, 150 / 5]);
  const concretoCalcada = usePbr(PBR.concreto, [520 / 4, 8 / 4]);

  const { calcadaMat, acessoMat, estacionamentoMat } = useMemo(
    () => ({
      calcadaMat: aplicarPbr(new MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.6 }), concretoCalcada, PBR.concreto, 0.6),
      acessoMat: aplicarPbr(
        new MeshStandardMaterial({ map: repetir(road, 1, 820 / 24), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }),
        asfaltoAcesso,
        PBR.asfalto,
        0.45,
      ),
      estacionamentoMat: aplicarPbr(
        new MeshStandardMaterial({ color: "#4a4b4d", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
        asfaltoPatio,
        PBR.asfalto,
        0.55,
      ),
    }),
    [road, concretoCalcada, asfaltoAcesso, asfaltoPatio],
  );

  const { roadMat, roadMatWide, deckColumns, parked, treeItems, poles, lights, garage } = useMemo(() => {
    const rm = new MeshStandardMaterial({ map: road.clone(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    rm.map!.wrapS = rm.map!.wrapT = RepeatWrapping;
    rm.map!.repeat.set(1, 520 / 24);
    rm.map!.rotation = Math.PI / 2;
    rm.map!.needsUpdate = true;
    const rw = new MeshStandardMaterial({ map: road.clone(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    rw.map!.wrapS = rw.map!.wrapT = RepeatWrapping;
    rw.map!.repeat.set(1, 1400 / 24);
    rw.map!.rotation = Math.PI / 2;
    rw.map!.needsUpdate = true;

    const cols: Xform[] = [];
    for (let x = -250; x <= 250; x += 22) for (const z of [20, 38]) cols.push({ p: [x, 2.2, z], s: [1.1, 4.4, 1.1] });

    const r = mulberry32(8);
    const pk: Xform[] = [];
    for (let row = 0; row < 8; row++) {
      const z = 92 + row * 16;
      for (let x = -170; x <= 170; x += 2.7) {
        if (Math.abs(x) < 9 || r() < 0.18) continue;
        pk.push({ p: [x, 0.8, z + (row % 2 ? 2.6 : -2.6)], s: [1.8, 1.2, 4.3] });
      }
    }
    const tr: Xform[] = [];
    for (let x = -300; x <= 300; x += 11) {
      if (Math.abs(x) < 12) continue;
      tr.push({ p: [x + r() * 3, 0, 72 + r() * 2], s: [0.8 + r() * 0.5, 0.8 + r() * 0.5, 1] });
      tr.push({ p: [x + r() * 3, 0, 238 + r() * 3], s: [0.8 + r() * 0.5, 0.9 + r() * 0.5, 1] });
    }
    for (let z = 80; z < 240; z += 9) for (const x of [-190, -12, 12, 190]) tr.push({ p: [x + r() * 2, 0, z], s: [0.7 + r() * 0.5, 0.8 + r() * 0.4, 1] });

    const pl: Xform[] = [];
    const L: LightSpec[] = [];
    for (let x = -250; x <= 250; x += 30) {
      pl.push({ p: [x, FLOOR + 5, 41], s: [1, 10, 1] });
      L.push({ pos: [x, FLOOR + 10, 39.5], color: [5, 4.2, 3.2], size: 0.7 });
    }
    for (let x = -680; x <= 680; x += 40) {
      pl.push({ p: [x, 5, 59], s: [1, 10, 1] });
      L.push({ pos: [x, 10, 57.5], color: [5, 3.2, 1.6], size: 0.7 });
      L.push({ pos: [x, 10, 60.5], color: [5, 3.2, 1.6], size: 0.7 });
    }
    for (let z = 90; z < 240; z += 40) for (let x = -160; x <= 160; x += 40) L.push({ pos: [x, 9, z], color: [4.5, 4.4, 4.2], size: 0.6 });

    // multi-storey car park (2019)
    const gs: Xform[] = [];
    for (let lvl = 0; lvl < 5; lvl++) gs.push({ p: [265, 0.4 + lvl * 3.2, 135], s: [130, 0.45, 130] });
    const gc: Xform[] = [];
    for (let x = 205; x <= 325; x += 12) for (let z = 75; z <= 195; z += 12) gc.push({ p: [x, 6.4, z], s: [0.6, 12.8, 0.6] });
    return { roadMat: rm, roadMatWide: rw, deckColumns: cols, parked: pk, treeItems: tr, poles: pl, lights: L, garage: { slabs: gs, cols: gc } };
  }, [road]);

  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const parkedMat = useMemo(() => new MeshStandardMaterial({ color: "#9aa0a6", roughness: 0.35, metalness: 0.5 }), []);
  const aero = useRef<Group>(null);

  useEffect(() => {
    aplicarPbr(roadMat, asfaltoEmbarque, PBR.asfalto, 0.45);
    aplicarPbr(roadMatWide, asfaltoAvenida, PBR.asfalto, 0.45);
  }, [roadMat, roadMatWide, asfaltoEmbarque, asfaltoAvenida]);

  useFrame(() => {
    if (!aero.current) return;
    const t = journey.time;
    const s = (Math.sin(t * 0.05) * 0.5 + 0.5) * 820;
    aero.current.position.z = 40 + s;
  });

  return (
    <group>
      {/* departures viaduct */}
      <mesh position={[0, FLOOR - 0.35, (FACADE_Z + 42) / 2]} material={m.concrete} castShadow receiveShadow>
        <boxGeometry args={[520, 0.7, 42 - FACADE_Z]} />
      </mesh>
      <mesh position={[0, FLOOR + 0.02, 20]} rotation-x={-Math.PI / 2} material={calcadaMat} receiveShadow>
        <planeGeometry args={[520, 8]} />
      </mesh>
      <mesh position={[0, FLOOR + 0.03, 31]} rotation-x={-Math.PI / 2} material={roadMat} receiveShadow>
        <planeGeometry args={[520, 14]} />
      </mesh>
      <mesh position={[0, FLOOR + 0.2, 24.2]} material={m.concrete} receiveShadow>
        <boxGeometry args={[520, 0.4, 0.4]} />
      </mesh>
      <mesh position={[0, FLOOR + 0.55, 41.8]} material={m.concrete} castShadow receiveShadow>
        <boxGeometry args={[520, 1.1, 0.4]} />
      </mesh>
      <StaticInstances geometry={box} material={m.concrete} items={deckColumns} castShadow />
      {/* zebra crossing from the kerb-side drop-off to the entrance */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={"zebra" + i} position={[0, FLOOR + 0.045, 25.3 + i * 1.7]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[5, 0.8]} />
          <meshStandardMaterial color="#e8e6df" roughness={0.8} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-8} />
        </mesh>
      ))}
      {/* ground-level roads and access avenue */}
      <mesh position={[0, 0.03, 58.5]} rotation-x={-Math.PI / 2} material={roadMatWide} receiveShadow>
        <planeGeometry args={[1400, 16]} />
      </mesh>
      <mesh position={[0, 0.025, 480]} rotation-x={-Math.PI / 2} material={acessoMat} receiveShadow>
        <planeGeometry args={[16, 820]} />
      </mesh>
      {/* parking */}
      <mesh position={[0, 0.02, 155]} rotation-x={-Math.PI / 2} material={estacionamentoMat} receiveShadow>
        <planeGeometry args={[370, 150]} />
      </mesh>
      <StaticInstances geometry={box} material={parkedMat} items={parked} castShadow />
      <Trees items={treeItems} />
      <StaticInstances geometry={box} material={m.steel} items={poles.map((p) => ({ ...p, s: [0.22, p.s![1], 0.22] }))} />
      {/* car park structure */}
      <StaticInstances geometry={box} material={m.concrete} items={garage.slabs} castShadow />
      <StaticInstances geometry={box} material={m.concrete} items={garage.cols} castShadow />
      {/* Aeromóvel guideway and car */}
      <group>
        {Array.from({ length: 36 }, (_, i) => (
          <mesh key={i} position={[-126, 3.5, 30 + i * 25]} material={m.concrete} castShadow>
            <boxGeometry args={[1.2, 7, 1.2]} />
          </mesh>
        ))}
        <mesh position={[-126, 7.4, 470]} material={m.concrete} castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.9, 900]} />
        </mesh>
        <group ref={aero} position={[-126, 8, 60]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <boxGeometry args={[2.9, 2.6, 12]} />
            <meshStandardMaterial color="#f2f2f0" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0, 2.1, 0]} material={m.tintedGlass}>
            <boxGeometry args={[2.95, 0.9, 10.5]} />
          </mesh>
          <mesh position={[0, 0.9, 0]} material={m.safetyOrange}>
            <boxGeometry args={[2.95, 0.25, 12]} />
          </mesh>
        </group>
      </group>
      <Traffic />
      <LightPoints lights={lights} day={0.05} night={1.1} />
    </group>
  );
}
