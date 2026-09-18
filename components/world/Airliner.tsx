"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from "three";
import {
  fanTexture,
  finGeometry,
  fuselageGeometry,
  fuselageSection,
  nacelleGeometry,
  stabGeometry,
  wingGeometry,
  type AirlinerSpec,
} from "@/lib/airliner";
import { frame } from "@/lib/frame";
import { liveryTexture, tailTexture, windowGlowTexture } from "@/lib/textures";
import LightPoints, { type LightSpec } from "./LightPoints";

export type Livery = "hero" | "blue" | "red" | "green";

export type AirlinerState = {
  gear: number; // 1 down … 0 retracted
  flaps: number; // 0 … 1
  fan: number; // rad / s
  cabinGlow: number; // 0 … 1
};

export const makeAirlinerState = (): AirlinerState => ({ gear: 1, flaps: 0, fan: 0, cabinGlow: 0 });

const geoCache = new Map<string, ReturnType<typeof buildGeometries>>();

function buildGeometries(spec: AirlinerSpec) {
  const tipX = spec.span;
  const tipLE = spec.rootLE + (spec.span - spec.radius * 0.6) * Math.tan(spec.sweep);
  const tipY = spec.wingY + (spec.span - spec.radius * 0.6) * Math.tan(spec.dihedral);
  return {
    fuselage: fuselageGeometry(spec),
    wingL: wingGeometry(spec, -1),
    wingR: wingGeometry(spec, 1),
    stabL: stabGeometry(spec, -1),
    stabR: stabGeometry(spec, 1),
    fin: finGeometry(spec),
    nacelle: nacelleGeometry(spec),
    fan: new CylinderGeometry(spec.engineR * 0.84, spec.engineR * 0.84, 0.05, 32).rotateX(Math.PI / 2),
    strut: new CylinderGeometry(0.11 * (spec.radius / 2), 0.13 * (spec.radius / 2), 1, 10),
    wheel: new CylinderGeometry(0.58 * (spec.radius / 2), 0.58 * (spec.radius / 2), 0.4, 20).rotateZ(Math.PI / 2),
    fairing: new SphereGeometry(1, 20, 12),
    tip: { x: tipX, le: tipLE, y: tipY },
  };
}

export default function Airliner({
  spec,
  livery,
  doorOpen = false,
  state,
  castShadow = true,
}: {
  spec: AirlinerSpec;
  livery: Livery;
  doorOpen?: boolean;
  state?: AirlinerState;
  castShadow?: boolean;
}) {
  const g = useMemo(() => {
    const key = spec.kind;
    if (!geoCache.has(key)) geoCache.set(key, buildGeometries(spec));
    return geoCache.get(key)!;
  }, [spec]);

  const m = useMemo(() => {
    const body = new MeshStandardMaterial({
      map: liveryTexture(livery, doorOpen),
      roughness: 0.3,
      metalness: 0.12,
      alphaTest: doorOpen ? 0.5 : 0,
      emissive: new Color("#ffcf8a"),
      emissiveMap: windowGlowTexture(),
      emissiveIntensity: 0,
    });
    const wing = new MeshStandardMaterial({ color: "#c3c8ce", roughness: 0.36, metalness: 0.55, side: DoubleSide });
    const nacelle = new MeshStandardMaterial({
      color: livery === "blue" ? "#1f4e9e" : "#e9ebee",
      roughness: 0.28,
      metalness: 0.3,
      side: DoubleSide,
    });
    const tail = new MeshStandardMaterial({ map: tailTexture(livery), roughness: 0.35, metalness: 0.1, side: DoubleSide });
    const fan = new MeshStandardMaterial({ map: fanTexture(), roughness: 0.5, metalness: 0.6 });
    const gear = new MeshStandardMaterial({ color: "#9aa0a8", roughness: 0.35, metalness: 0.85 });
    const tyre = new MeshStandardMaterial({ color: "#121315", roughness: 0.85 });
    const inner = new MeshBasicMaterial({ color: "#050506" });
    return { body, wing, nacelle, tail, fan, gear, tyre, inner };
  }, [livery, doorOpen]);

  const fans = useRef<Mesh[]>([]);
  const gearGroup = useRef<Group>(null);
  const flapsL = useRef<Mesh>(null);
  const flapsR = useRef<Mesh>(null);

  useFrame(() => {
    const s = state;
    const dt = frame.delta;
    const spin = s ? s.fan : 0.6;
    for (const f of fans.current) if (f) f.rotation.z += spin * dt;
    if (s && gearGroup.current) {
      gearGroup.current.visible = s.gear > 0.02;
      gearGroup.current.scale.y = Math.max(0.02, s.gear);
    }
    if (s) {
      if (flapsL.current) flapsL.current.rotation.x = s.flaps * 0.25;
      if (flapsR.current) flapsR.current.rotation.x = s.flaps * 0.25;
    }
    const glow = s ? s.cabinGlow : frame.dir.night;
    m.body.emissiveIntensity = glow * 1.6;
  });

  const lights = useMemo<LightSpec[]>(() => {
    const t = g.tip;
    const { dy } = fuselageSection(spec, spec.zTail - 0.3);
    return [
      { pos: [-t.x - 0.2, t.y + 0.1, t.le + 0.4], color: [6, 0.3, 0.2], size: 0.35 },
      { pos: [t.x + 0.2, t.y + 0.1, t.le + 0.4], color: [0.3, 6, 0.8], size: 0.35 },
      { pos: [-t.x - 0.2, t.y + 0.1, t.le + 0.9], color: [14, 14, 14], size: 0.6, blink: 1.3 },
      { pos: [t.x + 0.2, t.y + 0.1, t.le + 0.9], color: [14, 14, 14], size: 0.6, blink: 1.3 },
      { pos: [0, spec.centerY + dy + 0.2, spec.zTail + 0.1], color: [5, 5, 5], size: 0.3 },
      { pos: [0, spec.centerY + spec.radius + 0.12, 1.5], color: [8, 0.4, 0.2], size: 0.45, blink: 1.0 },
      { pos: [0, spec.centerY - spec.radius - 0.12, 3.5], color: [8, 0.4, 0.2], size: 0.45, blink: 1.0 },
      { pos: [-spec.radius * 0.9, spec.wingY - 0.3, spec.rootLE + 0.4], color: [10, 10, 9], size: 0.55 },
      { pos: [spec.radius * 0.9, spec.wingY - 0.3, spec.rootLE + 0.4], color: [10, 10, 9], size: 0.55 },
    ];
  }, [g, spec]);

  const S = spec.radius / 2;
  const engineMount = (side: 1 | -1) => [side * spec.engineX, spec.engineY, spec.engineZ] as [number, number, number];

  return (
    <group>
      <mesh geometry={g.fuselage} material={m.body} castShadow={castShadow} receiveShadow />
      <mesh geometry={g.wingL} material={m.wing} castShadow={castShadow} receiveShadow />
      <mesh geometry={g.wingR} material={m.wing} castShadow={castShadow} receiveShadow />
      <mesh geometry={g.stabL} material={m.wing} castShadow={castShadow} />
      <mesh geometry={g.stabR} material={m.wing} castShadow={castShadow} />
      <mesh geometry={g.fin} material={m.tail} castShadow={castShadow} />
      {/* wing-to-body fairing */}
      <mesh geometry={g.fairing} material={m.wing} position={[0, spec.wingY - 0.1, spec.rootLE + spec.rootChord * 0.55]} scale={[spec.radius * 0.95, spec.radius * 0.42, spec.rootChord * 0.75]} castShadow={castShadow} />
      {/* flaps (trailing-edge strips that droop for takeoff) */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          ref={side < 0 ? flapsL : flapsR}
          material={m.wing}
          position={[side * (spec.radius + spec.span * 0.22), spec.wingY + 0.15, spec.rootLE + spec.rootChord * 0.92 + spec.span * 0.12]}
          rotation={[state ? state.flaps * 0.25 : 0, side * -0.28, 0]}
          castShadow={castShadow}
        >
          <boxGeometry args={[spec.span * 0.42, 0.08 * S, 0.9 * S]} />
        </mesh>
      ))}
      {/* sharklets */}
      {([-1, 1] as const).map((side) => (
        <mesh key={"sh" + side} material={m.wing} position={[side * (g.tip.x + 0.3), g.tip.y + 1.1 * S, g.tip.le + 0.9 * S]} rotation={[0.25, 0, side * -0.3]} castShadow={castShadow}>
          <boxGeometry args={[0.1, 2.4 * S, 1.1 * S]} />
        </mesh>
      ))}
      {/* carenagens dos trilhos de flape, bem visíveis da janela */}
      {([-1, 1] as const).map((side) =>
        [0.28, 0.52, 0.76].map((t, i) => {
          const x = spec.radius * 0.6 + t * (spec.span - spec.radius * 0.6);
          const le = spec.rootLE + (x - spec.radius * 0.6) * Math.tan(spec.sweep);
          const chord = spec.rootChord + (spec.tipChord - spec.rootChord) * Math.pow(t, 0.85);
          const y = spec.wingY + (x - spec.radius * 0.6) * Math.tan(spec.dihedral);
          return (
            <mesh key={`f${side}${i}`} material={m.wing} position={[side * x, y - 0.22 * S, le + chord * 0.82]} rotation={[0.06, 0, 0]} castShadow={castShadow}>
              <capsuleGeometry args={[0.26 * S, 1.9 * S, 3, 8]} />
            </mesh>
          );
        }),
      )}
      {/* antenas e escapamento da APU */}
      {[
        [0, spec.centerY + spec.radius, -6],
        [0, spec.centerY + spec.radius, 2.5],
        [0, spec.centerY - spec.radius, -9],
      ].map((p, i) => (
        <mesh key={"ant" + i} material={m.wing} position={[p[0], p[1], p[2]]} castShadow={false}>
          <boxGeometry args={[0.05 * S, 0.5 * S, 0.5 * S]} />
        </mesh>
      ))}
      <mesh material={m.gear} position={[0, spec.centerY + spec.radius * 0.62, spec.zTail - 0.35]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.18 * S, 0.24 * S, 0.7 * S, 12]} />
      </mesh>
      {/* portas do trem de pouso */}
      {([-1, 1] as const).map((side) => (
        <mesh key={"gd" + side} material={m.body} position={[side * (spec.mainGearX + 0.75 * S), spec.wingY - 0.55 * S, 0]} rotation={[0, 0, side * 0.25]} castShadow={castShadow}>
          <boxGeometry args={[0.1 * S, 1.5 * S, 2.4 * S]} />
        </mesh>
      ))}
      {/* engines */}
      {([-1, 1] as const).map((side, i) => (
        <group key={"e" + side} position={engineMount(side)}>
          <mesh geometry={g.nacelle} material={m.nacelle} castShadow={castShadow} receiveShadow />
          <mesh
            geometry={g.fan}
            material={m.fan}
            position={[0, 0, spec.engineLen * 0.12]}
            ref={(el) => {
              if (el) fans.current[i] = el;
            }}
          />
          <mesh material={m.inner} position={[0, 0, spec.engineLen * 0.95]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[spec.engineR * 0.5, 24]} />
          </mesh>
          {/* pylon */}
          <mesh material={m.nacelle} position={[0, spec.engineR * 0.95, spec.engineLen * 0.55]} castShadow={castShadow}>
            <boxGeometry args={[0.3 * S, spec.engineR * 0.9, spec.engineLen * 0.9]} />
          </mesh>
        </group>
      ))}
      {/* landing gear */}
      <group ref={gearGroup}>
        <group position={[0, 0, spec.noseGearZ]}>
          <mesh geometry={g.strut} material={m.gear} position={[0, spec.centerY * 0.35, 0]} scale={[1, spec.centerY * 0.62, 1]} castShadow={castShadow} />
          {[-0.28, 0.28].map((x) => (
            <mesh key={x} geometry={g.wheel} material={m.tyre} position={[x * S * 1.4, 0.5 * S, 0]} scale={0.8} castShadow={castShadow} />
          ))}
        </group>
        {([-1, 1] as const).map((side) => (
          <group key={"mg" + side} position={[side * spec.mainGearX, 0, 0]}>
            <mesh geometry={g.strut} material={m.gear} position={[0, spec.wingY * 0.5, 0]} scale={[1.6, spec.wingY, 1.6]} castShadow={castShadow} />
            {(spec.kind === "wide" ? [-0.8, 0.8] : [0]).map((z) =>
              [-0.45, 0.45].map((x) => <mesh key={z + ":" + x} geometry={g.wheel} material={m.tyre} position={[x * S, 0.58 * S, z * S]} castShadow={castShadow} />),
            )}
          </group>
        ))}
      </group>
      <LightPoints lights={lights} day={0.9} night={1.4} minPx={1.2} />
    </group>
  );
}
