"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  Shape,
} from "three";
import { frame } from "@/lib/frame";
import { journey } from "@/lib/journey";
import { mats } from "@/lib/materials";
import { lerp, mulberry32 } from "@/lib/math";
import { cabinWallTexture, carpetTexture } from "@/lib/textures";
import { CABIN_FLOOR } from "@/lib/world";
import { StaticInstances, type Xform } from "./helpers";
import Crowd, { type Agent } from "./People";

const Y = CABIN_FLOOR;
const CY = 4.3; // fuselage centre
const R = 1.86;
const Z0 = -13.6;
const Z1 = 14.6;
const PITCH = 0.533;
const WALL_Z0 = -10.8 - PITCH / 2;
export const ROW_PITCH = 0.79;
export const FIRST_ROW = -9.5;
/** the seat the camera takes (row 20, left window, just aft of the wing) */
export const CAMERA_ROW = 20;

/** Curved sidewall with inward normals and u running along the cabin (for the window repeat). */
function wallGeometry(side: 1 | -1, z0: number, z1: number, a0: number, a1: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const segA = 12;
  const zs = [z0, z1];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j <= segA; j++) {
      const a = a0 + ((a1 - a0) * j) / segA;
      pos.push(side * R * Math.cos(a), CY + R * Math.sin(a), zs[i]);
      uv.push((zs[i] - WALL_Z0) / PITCH, j / segA);
    }
  }
  const row = segA + 1;
  for (let j = 0; j < segA; j++) {
    const a = j;
    const b = j + row;
    if (side < 0) idx.push(a, a + 1, b, b, a + 1, b + 1);
    else idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export default function Cabin() {
  const group = useRef<Group>(null);
  const m = mats();
  const moodMat = useRef<MeshBasicMaterial>(null);
  const ambient = useRef<AmbientLight>(null);

  const g = useMemo(() => {
    const aLow = -Math.asin((CY - Y) / R); // floor level
    const aHigh = Math.asin((5.32 - CY) / R); // under the bins
    const wallTex = cabinWallTexture();
    const wallMat = new MeshStandardMaterial({ map: wallTex, alphaTest: 0.5, roughness: 0.55, color: "#f1efea" });
    const plainMat = new MeshStandardMaterial({ color: "#e6e3dc", roughness: 0.6 });
    const carpet = carpetTexture().clone();
    carpet.wrapS = carpet.wrapT = RepeatWrapping;
    carpet.repeat.set(3, 26);
    carpet.needsUpdate = true;
    const floorMat = new MeshStandardMaterial({ map: carpet, roughness: 0.95 });

    const binShape = new Shape();
    binShape.moveTo(-1.66, 5.3);
    binShape.lineTo(-0.98, 5.3);
    binShape.quadraticCurveTo(-0.84, 5.55, -0.94, 5.86);
    binShape.lineTo(-1.5, 5.98);
    binShape.lineTo(-1.66, 5.3);
    const bin = new ExtrudeGeometry(binShape, { depth: Z1 - (Z0 + 2.2), bevelEnabled: false });
    bin.translate(0, 0, Z0 + 2.2);

    const ceilShape = new Shape();
    ceilShape.moveTo(-1.0, 5.95);
    ceilShape.quadraticCurveTo(0, 6.12, 1.0, 5.95);
    ceilShape.lineTo(1.0, 6.02);
    ceilShape.quadraticCurveTo(0, 6.2, -1.0, 6.02);
    ceilShape.lineTo(-1.0, 5.95);
    const ceil = new ExtrudeGeometry(ceilShape, { depth: Z1 - Z0, bevelEnabled: false });
    ceil.translate(0, 0, Z0);

    return {
      wallL: wallGeometry(-1, WALL_Z0, Z1, aLow, aHigh),
      wallR: wallGeometry(1, WALL_Z0, Z1, aLow, aHigh),
      doorWallR: wallGeometry(1, Z0, WALL_Z0, aLow, aHigh),
      doorWallL1: wallGeometry(-1, Z0, -12.95, aLow, aHigh),
      doorWallL2: wallGeometry(-1, -12.05, WALL_Z0, aLow, aHigh),
      wallMat,
      plainMat,
      floorMat,
      bin,
      ceil,
    };
  }, []);

  const seats = useMemo(() => {
    const cushion: Xform[] = [];
    const back: Xform[] = [];
    const head: Xform[] = [];
    const arm: Xform[] = [];
    const screen: Xform[] = [];
    const agents: Agent[] = [];
    const r = mulberry32(77);
    const xs = [-1.33, -0.9, -0.47, 0.47, 0.9, 1.33];
    for (let row = 0; row < 30; row++) {
      const z = FIRST_ROW + row * ROW_PITCH;
      if (z > 13.4) break;
      xs.forEach((x, k) => {
        cushion.push({ p: [x, Y + 0.44, z], s: [0.43, 0.11, 0.46] });
        back.push({ p: [x, Y + 0.84, z + 0.25], r: [0.13, 0, 0], s: [0.43, 0.72, 0.09] });
        head.push({ p: [x, Y + 1.12, z + 0.2], r: [0.13, 0, 0], s: [0.34, 0.2, 0.012] });
        screen.push({ p: [x, Y + 0.98, z + 0.3], r: [0.13, 0, 0], s: [0.2, 0.13, 0.005] });
        if (k === 0 || k === 3) arm.push({ p: [x - 0.235, Y + 0.62, z + 0.02], s: [0.05, 0.05, 0.42] });
        arm.push({ p: [x + 0.235, Y + 0.62, z + 0.02], s: [0.05, 0.05, 0.42] });
        const isCamera = row === CAMERA_ROW && k === 0;
        const nearCamera = row === CAMERA_ROW && k === 1;
        if (!isCamera && !nearCamera && r() < 0.72) agents.push({ kind: "sit", a: [x, Y - 0.02, z + 0.02], yaw: Math.PI, seed: 2000 + row * 10 + k });
      });
    }
    // cabin crew: one greets at the door, one performs the safety demo mid-cabin
    agents.push({ kind: "stand", a: [0.75, Y, -13.25], yaw: -Math.PI / 2.4, seed: 3001, uniform: true });
    agents.push({ kind: "stand", a: [0, Y, -2.4], yaw: 0, seed: 3002, uniform: true });
    agents.push({ kind: "walk", a: [0, Y, 6], b: [0, Y, 12.5], speed: 0.45, seed: 3003, uniform: true });
    return { cushion, back, head, arm, screen, agents };
  }, []);

  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const psu = useMemo(() => {
    const lights: Xform[] = [];
    for (let row = 0; row < 29; row++) {
      const z = FIRST_ROW + row * ROW_PITCH - 0.1;
      for (const x of [-1.06, 1.06]) lights.push({ p: [x, 5.27, z], s: [0.36, 0.02, 0.1] });
    }
    return lights;
  }, []);
  const binLines = useMemo(() => {
    const l: Xform[] = [];
    for (let z = Z0 + 2.2; z < Z1; z += 1.58) for (const x of [-0.9, 0.9]) l.push({ p: [x, 5.58, z], s: [0.02, 0.5, 0.012] });
    return l;
  }, []);
  const moodColor = useMemo(() => new Color(), []);
  const white = useMemo(() => new Color(3.2, 3.0, 2.8), []);
  const blue = useMemo(() => new Color(0.9, 1.1, 3.4), []);
  const seatMat = useMemo(() => new MeshStandardMaterial({ color: "#4a5f86", roughness: 0.9 }), []);

  useFrame(() => {
    const p = journey.render;
    const vis = p > 0.43 && p < 0.875;
    if (group.current) group.current.visible = vis;
    const mood = frame.dir.cabinMood;
    moodColor.copy(white).lerp(blue, mood);
    if (moodMat.current) moodMat.current.color.copy(moodColor).multiplyScalar(lerp(1, 0.55, mood));
    if (ambient.current) ambient.current.intensity = frame.shot.inAircraft * lerp(0.9, 0.35, mood) * (vis ? 1 : 0);
  });

  return (
    <>
      {/* ambient stays mounted so the light count never changes */}
      <ambientLight ref={ambient} color="#fff1e0" intensity={0} />
      <group ref={group}>
        <mesh geometry={g.wallL} material={g.wallMat} receiveShadow />
        <mesh geometry={g.wallR} material={g.wallMat} receiveShadow />
        <mesh geometry={g.doorWallR} material={g.plainMat} />
        <mesh geometry={g.doorWallL1} material={g.plainMat} />
        <mesh geometry={g.doorWallL2} material={g.plainMat} />
        <mesh position={[0, Y, (Z0 + Z1) / 2]} rotation-x={-Math.PI / 2} material={g.floorMat} receiveShadow>
          <planeGeometry args={[3.3, Z1 - Z0]} />
        </mesh>
        <mesh geometry={g.bin} material={m.white} castShadow receiveShadow />
        <mesh geometry={g.bin} material={m.white} scale={[-1, 1, 1]} castShadow receiveShadow />
        <mesh geometry={g.ceil} material={m.offWhite} />
        {/* cove lighting along both bins */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.97, 5.93, (Z0 + 2.2 + Z1) / 2]}>
            <boxGeometry args={[0.04, 0.03, Z1 - Z0 - 2.2]} />
            <meshBasicMaterial ref={s < 0 ? moodMat : undefined} color={new Color(3.2, 3, 2.8)} toneMapped={false} />
          </mesh>
        ))}
        {/* forward bulkhead & galley */}
        <mesh position={[0, 4.4, Z0]} material={g.plainMat}>
          <boxGeometry args={[3.4, 2.4, 0.1]} />
        </mesh>
        <mesh position={[0.9, 4.2, Z0 + 0.45]} material={m.steel}>
          <boxGeometry args={[1.3, 1.8, 0.8]} />
        </mesh>
        <mesh position={[0, 5.2, Z1]} material={g.plainMat}>
          <boxGeometry args={[3.4, 2, 0.1]} />
        </mesh>
        {/* exit signs */}
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x * 4, 5.72, -1.2]} material={m.green}>
            <boxGeometry args={[0.28, 0.1, 0.02]} />
          </mesh>
        ))}
        <StaticInstances geometry={box} material={seatMat} items={seats.cushion} />
        <StaticInstances geometry={box} material={seatMat} items={seats.back} castShadow />
        <StaticInstances geometry={box} material={m.headrest} items={seats.head} />
        <StaticInstances geometry={box} material={m.darkSteel} items={seats.arm} />
        <StaticInstances geometry={box} material={m.screenGlow} items={seats.screen} receiveShadow={false} />
        <StaticInstances geometry={box} material={m.lightWarm} items={psu} receiveShadow={false} />
        <StaticInstances geometry={box} material={m.darkConcrete} items={binLines} receiveShadow={false} />
        <Crowd agents={seats.agents} visibleIn={[[0.43, 0.875]]} scale={0.97} />
      </group>
    </>
  );
}
