"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, Euler, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { NARROW, WIDE } from "@/lib/airliner";
import { frame } from "@/lib/frame";
import { journey } from "@/lib/journey";
import { mats } from "@/lib/materials";
import { clamp, lerp, mulberry32, smoothstep } from "@/lib/math";
import { PHASE, RUNWAY, TAXIWAY_Z } from "@/lib/world";
import Airliner, { makeAirlinerState } from "./Airliner";
import Cabin from "./Cabin";
import { StaticInstances, type Xform } from "./helpers";
import Crowd, { rampAgents } from "./People";

/* ------------------------------------------------------------------ hero */

export function HeroAircraft() {
  const group = useRef<Group>(null);
  const tug = useRef<Group>(null);
  const plug = useRef<Mesh>(null);
  const state = useMemo(() => makeAirlinerState(), []);
  const plugGeo = useMemo(() => {
    const arc = 1.85 / (NARROW.radius + 0.01);
    return new CylinderGeometry(NARROW.radius + 0.012, NARROW.radius + 0.012, 0.82, 10, 1, true, (3 * Math.PI) / 2 - arc / 2, arc).rotateX(Math.PI / 2);
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const pose = frame.pose;
    g.position.copy(pose.position);
    g.quaternion.copy(pose.quaternion);
    const p = journey.render + journey.finaleRender * 0.5;
    state.gear = 1 - smoothstep(0.668, 0.688, p);
    state.flaps = smoothstep(0.55, 0.57, p) * (1 - smoothstep(0.7, 0.72, p));
    state.fan = 1.5 + pose.thrust * 55;
    state.cabinGlow = smoothstep(0.84, 0.95, p) * clamp(frame.dir.night + 0.4);
    if (tug.current) tug.current.visible = p > PHASE.push0 - 0.02 && p < PHASE.push1 + 0.002;
    // the L1 door closes once everyone is aboard
    if (plug.current) plug.current.visible = p > 0.508;
  });

  return (
    <group ref={group}>
      <Airliner spec={NARROW} livery="hero" doorOpen state={state} />
      <mesh ref={plug} geometry={plugGeo} position={[0, NARROW.centerY - 0.07, -12.5]} castShadow>
        <meshStandardMaterial color="#f1f2f3" roughness={0.3} metalness={0.12} />
      </mesh>
      <Cabin />
      {/* pushback tug, coupled to the nose gear */}
      <group ref={tug} position={[0, 0, NARROW.noseGearZ - 5.2]}>
        <mesh position={[0, 0.8, 0]} material={mats().safetyYellow} castShadow>
          <boxGeometry args={[2.6, 1.2, 6]} />
        </mesh>
        <mesh position={[0, 1.8, -1.8]} material={mats().graphite} castShadow>
          <boxGeometry args={[1.8, 1, 1.4]} />
        </mesh>
        <mesh position={[0, 0.6, 3.6]} material={mats().darkSteel}>
          <boxGeometry args={[0.2, 0.2, 2.4]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ parked fleet & apron */

function GroundVehicles() {
  const m = mats();
  const train = useRef<Group>(null);
  const white = useMemo(() => new MeshStandardMaterial({ color: "#e8e8e4", roughness: 0.4 }), []);
  useFrame(() => {
    const g = train.current;
    if (!g) return;
    // baggage train loops between the terminal service road and the aft hold
    const t = (journey.time * 0.035) % 1;
    const u = t < 0.5 ? t * 2 : 2 - t * 2;
    g.position.set(lerp(-40, -8, u), 0, lerp(-60, -96, u));
    g.rotation.y = t < 0.5 ? -2.4 : 0.74;
  });
  const cart = (z: number) => (
    <group position={[0, 0, z]} key={z}>
      <mesh position={[0, 0.7, 0]} material={m.darkSteel} castShadow>
        <boxGeometry args={[1.6, 0.3, 2.6]} />
      </mesh>
      <mesh position={[0, 1.35, 0]} material={m.safetyOrange} castShadow>
        <boxGeometry args={[1.5, 1, 2.3]} />
      </mesh>
    </group>
  );
  return (
    <group>
      {/* baggage tractor + carts */}
      <group ref={train}>
        <mesh position={[0, 0.8, 0]} material={m.safetyYellow} castShadow>
          <boxGeometry args={[1.5, 1.2, 2.6]} />
        </mesh>
        {cart(3.4)}
        {cart(6.6)}
        {cart(9.8)}
      </group>
      {/* belt loader at the aft hold (right side of the aircraft = world −X) */}
      <group position={[-3.6, 0, -95]} rotation-y={0.35}>
        <mesh position={[0, 0.7, 0]} material={m.safetyYellow} castShadow>
          <boxGeometry args={[1.8, 1, 7]} />
        </mesh>
        <mesh position={[0, 2, -0.6]} rotation-x={0.34} material={m.rubber} castShadow>
          <boxGeometry args={[0.9, 0.2, 7.5]} />
        </mesh>
      </group>
      {/* catering truck at R1 */}
      <group position={[-4.6, 0, -66]}>
        <mesh position={[0, 1.3, 2.5]} material={white} castShadow>
          <boxGeometry args={[2.4, 2.2, 2.6]} />
        </mesh>
        <mesh position={[0, 4.6, -0.8]} material={white} castShadow>
          <boxGeometry args={[2.5, 2.6, 6]} />
        </mesh>
        <mesh position={[0, 2.4, -0.8]} material={m.steel}>
          <boxGeometry args={[1.8, 1.6, 4]} />
        </mesh>
      </group>
      {/* fuel truck under the right wing */}
      <group position={[-11, 0, -80]} rotation-y={0.2}>
        <mesh position={[0, 1.6, 0]} rotation-x={Math.PI / 2} material={white} castShadow>
          <cylinderGeometry args={[1.2, 1.2, 8, 20]} />
        </mesh>
        <mesh position={[0, 1.3, 5]} material={m.graphite} castShadow>
          <boxGeometry args={[2.4, 2.2, 2.4]} />
        </mesh>
      </group>
      {/* GPU cart & cones */}
      <mesh position={[3, 0.6, -58]} material={m.safetyYellow} castShadow>
        <boxGeometry args={[1.4, 1.2, 2]} />
      </mesh>
      {[
        [0, -54.5],
        [5.5, -80],
        [-5.5, -80],
        [0, -99],
      ].map(([x, z]) => (
        <mesh key={x + ":" + z} position={[x, 0.35, z]} material={m.safetyOrange}>
          <coneGeometry args={[0.2, 0.7, 10]} />
        </mesh>
      ))}
    </group>
  );
}

/** Contêineres de bagagem, carretas, calços e cones espalhados pelo pátio. */
function DetalhePatio() {
  const m = mats();
  const { ulds, carretas, rodasCarreta, calcos, cones, paletes } = useMemo(() => {
    const r = mulberry32(777);
    const u: Xform[] = [];
    const c: Xform[] = [];
    const rd: Xform[] = [];
    const ch: Xform[] = [];
    const co: Xform[] = [];
    const pa: Xform[] = [];
    // fileira de contêineres junto à via de serviço
    for (let i = 0; i < 12; i++) {
      const x = -120 + i * 9 + (r() - 0.5) * 2;
      u.push({ p: [x, 1.1, -232 + (r() - 0.5) * 3], r: [0, (r() - 0.5) * 0.3, 0], s: [1, 1, 1] });
    }
    // contêineres e carretas ao lado da aeronave principal
    for (let i = 0; i < 4; i++) {
      u.push({ p: [-7 - i * 2.6, 1.1, -96 + (r() - 0.5) * 1.5], r: [0, 1.5 + (r() - 0.5) * 0.2, 0] });
    }
    for (let i = 0; i < 5; i++) {
      const x = 12 + i * 3.4;
      const z = -104 + (r() - 0.5) * 2;
      c.push({ p: [x, 0.62, z], r: [0, 0.1 * i, 0], s: [2.4, 0.18, 3.2] });
      for (const [dx, dz] of [
        [-1, -1.3],
        [1, -1.3],
        [-1, 1.3],
        [1, 1.3],
      ])
        rd.push({ p: [x + dx, 0.28, z + dz], r: [0, 0, Math.PI / 2], s: [1, 1, 1] });
    }
    // calços nas rodas da aeronave no portão
    for (const side of [-1, 1]) {
      for (const dz of [-1.2, 1.2]) ch.push({ p: [side * 3.8, 0.12, -79 + dz], r: [0, 0, 0], s: [0.7, 0.24, 0.35] });
    }
    // cones ao redor das posições de estacionamento
    for (const gx of [-150, -75, 0, 75, 150]) {
      for (const [dx, dz] of [
        [-9, -52],
        [9, -52],
        [-20, -78],
        [20, -78],
        [0, -100],
      ])
        co.push({ p: [gx + dx, 0.35, dz], r: [0, 0, 0], s: [1, 1, 1] });
    }
    for (let i = 0; i < 6; i++) pa.push({ p: [-40 + i * 3, 0.08, -226], r: [0, r() * 0.4, 0], s: [1.2, 0.14, 1.0] });
    return { ulds: u, carretas: c, rodasCarreta: rd, calcos: ch, cones: co, paletes: pa };
  }, []);

  const uld = useMemo(() => {
    // contêiner com o canto chanfrado, como os de porão
    const g = new BoxGeometry(2.2, 1.9, 1.5);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      if (x < -0.9 && y > 0.5) pos.setX(i, x + 0.75);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const roda = useMemo(() => new CylinderGeometry(0.26, 0.26, 0.18, 10).rotateZ(Math.PI / 2), []);
  const cone = useMemo(() => new ConeGeometry(0.22, 0.7, 10), []);
  const aluminio = useMemo(() => new MeshStandardMaterial({ color: "#b9bec4", roughness: 0.45, metalness: 0.75 }), []);
  const madeira = useMemo(() => new MeshStandardMaterial({ color: "#8a6a45", roughness: 0.9 }), []);

  return (
    <group>
      <StaticInstances geometry={uld} material={aluminio} items={ulds} castShadow />
      <StaticInstances geometry={box} material={m.darkSteel} items={carretas} castShadow />
      <StaticInstances geometry={roda} material={m.rubber} items={rodasCarreta} />
      <StaticInstances geometry={box} material={m.safetyYellow} items={calcos} castShadow />
      <StaticInstances geometry={cone} material={m.safetyOrange} items={cones} castShadow />
      <StaticInstances geometry={box} material={madeira} items={paletes} castShadow />
    </group>
  );
}

export function ParkedFleet() {
  const group = useRef<Group>(null);
  useFrame(() => {
    // parked neighbours disappear once we are well above the city (saves draw calls)
    const p = journey.render;
    if (group.current) group.current.visible = p < 0.74 || p > 0.86 || journey.finaleRender > 0;
  });
  const apronOps = useRef<Group>(null);
  const ramp = useMemo(() => rampAgents(), []);
  useFrame(() => {
    if (apronOps.current) apronOps.current.visible = journey.render < PHASE.push1 + 0.01;
  });
  return (
    <group ref={group}>
      <group position={[-75, 0, -90]} rotation-y={Math.PI}>
        <Airliner spec={WIDE} livery="blue" />
      </group>
      <group position={[75, 0, -79]} rotation-y={Math.PI}>
        <Airliner spec={NARROW} livery="red" />
      </group>
      <group position={[150, 0, -79]} rotation-y={Math.PI}>
        <Airliner spec={NARROW} livery="green" castShadow={false} />
      </group>
      <group position={[-150, 0, -79]} rotation-y={Math.PI}>
        <Airliner spec={NARROW} livery="blue" castShadow={false} />
      </group>
      <DetalhePatio />
      <group ref={apronOps}>
        <GroundVehicles />
        <Crowd agents={ramp} visibleIn={[[0.2, 0.56]]} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ ambient traffic */

const _q = new Quaternion();
const _e = new Euler(0, 0, 0, "YXZ");
const _v = new Vector3();

/** A narrow-body taxiing along the parallel taxiway, and another landing on runway 29, both time-looped. */
export function AmbientTraffic() {
  const taxi = useRef<Group>(null);
  const lander = useRef<Group>(null);
  const landerState = useMemo(() => ({ ...makeAirlinerState(), fan: 18 }), []);

  useFrame(() => {
    const t = journey.time;
    const p = journey.render;
    const f = journey.finaleRender;

    // taxiing westbound on the parallel taxiway
    if (taxi.current) {
      const u = (t / 110) % 1;
      const x = lerp(700, -2300, u);
      taxi.current.position.set(x, 0, TAXIWAY_Z);
      taxi.current.rotation.set(0, Math.PI / 2, 0);
      taxi.current.visible = (p < 0.5 || p > 0.86 || f > 0) && !(p > 0.54 && p < 0.7);
    }

    // arrivals on runway 29: 3° glide path from the east, flare, rollout, vacate
    if (lander.current) {
      const period = 70;
      const u = (t % period) / period;
      const touchX = RUNWAY.x1 - 350;
      let x: number, y: number, pitch: number;
      if (u < 0.55) {
        const k = u / 0.55;
        x = lerp(touchX + 9000, touchX, k);
        y = (x - touchX) * Math.tan(0.0524);
        pitch = 0.05;
        y = Math.max(y, 0) + (1 - smoothstep(0.9, 1, k)) * 0;
      } else {
        const k = (u - 0.55) / 0.45;
        const ease = 1 - Math.pow(1 - k, 2);
        x = lerp(touchX, -1350, ease);
        y = 0;
        pitch = 0.05 * (1 - smoothstep(0, 0.12, k));
      }
      landerState.gear = 1;
      landerState.flaps = 1;
      lander.current.position.set(x, y, RUNWAY.z);
      _e.set(pitch, Math.PI / 2, 0, "YXZ");
      lander.current.quaternion.copy(_q.setFromEuler(_e));
      const hide = p > 0.54 && p < 0.72;
      lander.current.visible = !hide && u < 0.97;
    }
    void _v;
  });

  return (
    <>
      <group ref={taxi}>
        <Airliner spec={NARROW} livery="green" castShadow={false} />
      </group>
      <group ref={lander}>
        <Airliner spec={NARROW} livery="red" state={landerState} castShadow={false} />
      </group>
    </>
  );
}
