"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
} from "three";
import { BOARD_FLIGHTS } from "@/lib/content";
import { frame, useVisibleIn } from "@/lib/frame";
import { journey } from "@/lib/journey";
import { mats } from "@/lib/materials";
import { mulberry32 } from "@/lib/math";
import { aplicarPbr, PBR, usePbr } from "@/lib/pbr";
import { clamp, smoothstep, window4 } from "@/lib/math";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DeparturesBoard, facadeLetteringTexture, floorTexture, floorWearTexture, signTexture } from "@/lib/textures";
import { BRIDGE, FACADE_Z, FLOOR, GLASS_Z, SECURITY_Z, TERMINAL_HALF_W } from "@/lib/world";
import { between, ReflectiveFloor, StaticInstances, type Xform } from "./helpers";
import { InstancedModel, MODELO, porQualidade } from "./Props";

const HW = TERMINAL_HALF_W;
export const roofY = (z: number) => 17.5 + 6.5 * Math.sin((Math.PI * (z + 50)) / 80);

/* ------------------------------------------------------------------ roof */

function Roof() {
  const m = mats();
  // a geometria extrudada traz UV em metros, então a repetição é direta: 4 m
  const concreto = usePbr(PBR.concreto, [0.25, 0.25]);
  const { segments, lights, underside } = useMemo(() => {
    const top: [number, number][] = [];
    for (let z = -53; z <= 32; z += 1.5) top.push([-z, roofY(z)]);
    const shape = new Shape();
    shape.moveTo(top[0][0], top[0][1]);
    for (const [x, y] of top.slice(1)) shape.lineTo(x, y);
    for (let i = top.length - 1; i >= 0; i--) shape.lineTo(top[i][0], top[i][1] - 1.2);
    const geo = new ExtrudeGeometry(shape, { depth: 17, bevelEnabled: false, curveSegments: 1 });
    geo.rotateY(Math.PI / 2);
    const segs: number[] = [];
    for (let i = 0; i < 12; i++) segs.push(-113 + i * 19);

    const lightItems: Xform[] = [];
    for (const x0 of segs) {
      for (let z = -44; z <= 28; z += 3.2) {
        for (const off of [4.5, 12.5]) lightItems.push({ p: [x0 + off, roofY(z) - 1.35, z], s: [0.22, 0.08, 2.4] });
      }
    }
    const under = new MeshStandardMaterial({ color: "#d8d2c6", roughness: 0.75, side: DoubleSide });
    return { segments: segs.map((x) => ({ x, geo })), lights: lightItems, underside: under };
  }, []);
  useEffect(() => {
    aplicarPbr(underside, concreto, PBR.concreto, 0.5);
  }, [underside, concreto]);
  const lightGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);

  return (
    <group>
      {segments.map((s) => (
        <mesh key={s.x} geometry={s.geo} material={underside} position={[s.x, 0, 0]} castShadow receiveShadow />
      ))}
      {/* skylight glazing in the gaps (does not cast shadows → sun shafts) */}
      {segments.slice(0, -1).map((s) => (
        <mesh key={"g" + s.x} position={[s.x + 18, 23, -10]} material={m.glass}>
          <boxGeometry args={[2, 0.05, 1]} />
        </mesh>
      ))}
      <StaticInstances geometry={lightGeo} material={m.lightWarm} items={lights} receiveShadow={false} />
      {/* fascia with the airport name, facing the approach road */}
      <mesh position={[0, roofY(32) - 0.2, 32.2]} rotation-x={-0.08}>
        <planeGeometry args={[76, 9.5]} />
        <meshStandardMaterial
          map={facadeLetteringTexture()}
          transparent
          alphaTest={0.4}
          color="#ffffff"
          emissive={new Color("#fff1dc")}
          emissiveMap={facadeLetteringTexture()}
          emissiveIntensity={0.6}
          roughness={0.4}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <mesh position={[0, roofY(32) - 0.6, 32]} material={mats().graphite} castShadow>
        <boxGeometry args={[228, 1.4, 0.6]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ facade */

function Facade() {
  const m = mats();
  const doors = useRef<Group>(null);
  const concretoParede = usePbr(PBR.concreto, [62 / 4, 14 / 4]);
  const parede = useMemo(
    () => aplicarPbr(new MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.55 }), concretoParede, PBR.concreto, 0.5),
    [concretoParede],
  );
  const { mullions, transoms } = useMemo(() => {
    const mu: Xform[] = [];
    const tr: Xform[] = [];
    for (let x = -HW; x <= HW; x += 3) {
      const h = roofY(FACADE_Z) - FLOOR;
      mu.push({ p: [x, FLOOR + h / 2, FACADE_Z], s: [0.14, h, 0.35] });
    }
    for (const y of [FLOOR + 3.2, FLOOR + 8, FLOOR + 12.5]) tr.push({ p: [0, y, FACADE_Z], s: [HW * 2, 0.1, 0.3] });
    // airside glass wall
    for (let x = -HW; x <= HW; x += 3) {
      const h = roofY(GLASS_Z) - FLOOR;
      mu.push({ p: [x, FLOOR + h / 2, GLASS_Z], s: [0.12, h, 0.3] });
    }
    for (const y of [FLOOR + 3, FLOOR + 8.5]) tr.push({ p: [0, y, GLASS_Z], s: [HW * 2, 0.1, 0.25] });
    return { mullions: mu, transoms: tr };
  }, []);
  const unit = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const facadeH = roofY(FACADE_Z) - FLOOR;
  const glassH = roofY(GLASS_Z) - FLOOR;

  useFrame(() => {
    const g = doors.current;
    if (!g) return;
    const open = smoothstep(0.108, 0.122, journey.render) * (1 - smoothstep(0.15, 0.17, journey.render));
    g.children[0].position.x = -0.8 - open * 1.55;
    g.children[1].position.x = 0.8 + open * 1.55;
  });

  const entranceSign = useMemo(
    () => signTexture([{ text: "Embarque · Departures", sub: "Terminal 1 · Portões / Gates 1–16" }], { w: 1024, h: 200, fg: "#ffffff", accent: "#f5c542" }),
    [],
  );

  return (
    <group>
      <StaticInstances geometry={unit} material={m.darkSteel} items={mullions} castShadow />
      <StaticInstances geometry={unit} material={m.darkSteel} items={transoms} />
      {/* landside curtain wall (split around the entrance) */}
      <mesh position={[-(HW + 3.2) / 2, FLOOR + facadeH / 2, FACADE_Z]} material={m.glass}>
        <planeGeometry args={[HW - 3.2, facadeH]} />
      </mesh>
      <mesh position={[(HW + 3.2) / 2, FLOOR + facadeH / 2, FACADE_Z]} material={m.glass}>
        <planeGeometry args={[HW - 3.2, facadeH]} />
      </mesh>
      <mesh position={[0, FLOOR + 3.4 + (facadeH - 3.4) / 2, FACADE_Z]} material={m.glass}>
        <planeGeometry args={[6.4, facadeH - 3.4]} />
      </mesh>
      {/* entrance portal + automatic sliding doors */}
      <group position={[0, FLOOR, FACADE_Z]}>
        <mesh position={[0, 3.25, 0.2]} material={m.graphite} castShadow>
          <boxGeometry args={[7.2, 0.5, 1.2]} />
        </mesh>
        <mesh position={[-3.45, 1.5, 0.2]} material={m.graphite} castShadow>
          <boxGeometry args={[0.3, 3, 1.2]} />
        </mesh>
        <mesh position={[3.45, 1.5, 0.2]} material={m.graphite} castShadow>
          <boxGeometry args={[0.3, 3, 1.2]} />
        </mesh>
        <mesh position={[0, 4.2, 0.85]}>
          <planeGeometry args={[6.4, 1.25]} />
          <meshBasicMaterial map={entranceSign} toneMapped={false} color={new Color(1.6, 1.6, 1.6)} />
        </mesh>
        <group ref={doors}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.8, 1.5, 0]}>
              <mesh material={m.glass}>
                <boxGeometry args={[1.6, 3, 0.04]} />
              </mesh>
              <mesh position={[0, 0, 0]} material={m.steel}>
                <boxGeometry args={[1.62, 0.08, 0.06]} />
              </mesh>
              <mesh position={[s * 0.78, 0, 0]} material={m.steel}>
                <boxGeometry args={[0.05, 3, 0.06]} />
              </mesh>
            </group>
          ))}
        </group>
        {/* door sensor light */}
        <mesh position={[0, 3.05, 0.82]} material={m.green}>
          <boxGeometry args={[0.3, 0.04, 0.02]} />
        </mesh>
      </group>
      {/* airside glass wall with the jet-bridge doorway */}
      <mesh position={[-HW / 2 + 5.5, FLOOR + glassH / 2, GLASS_Z]} material={m.glass}>
        <planeGeometry args={[HW + 11, glassH]} />
      </mesh>
      <mesh position={[(HW + 16.5) / 2, FLOOR + glassH / 2, GLASS_Z]} material={m.glass}>
        <planeGeometry args={[HW - 16.5, glassH]} />
      </mesh>
      <mesh position={[13.5, FLOOR + 3 + (glassH - 3) / 2, GLASS_Z]} material={m.glass}>
        <planeGeometry args={[5, glassH - 3]} />
      </mesh>
      {/* side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * HW, FLOOR + 7, -15]} rotation-y={Math.PI / 2} material={parede} receiveShadow>
          <planeGeometry args={[62, 14]} />
        </mesh>
      ))}
      {/* arrivals level below */}
      <mesh position={[0, 2.2, 10]} material={m.tintedGlass}>
        <planeGeometry args={[HW * 2, 4.4]} />
      </mesh>
      <mesh position={[0, 2.4, 6]} material={m.lightPanel}>
        <planeGeometry args={[HW * 2, 0.35]} />
      </mesh>
      <mesh position={[0, FLOOR - 0.35, -15]} material={m.concrete} castShadow receiveShadow>
        <boxGeometry args={[HW * 2, 0.7, 62]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ columns */

function Columns() {
  const m = mats();
  const items = useMemo(() => {
    const shafts: Xform[] = [];
    const struts: Xform[] = [];
    for (const x of [-85.5, -47.5, -9.5, 9.5, 47.5, 85.5]) {
      for (const z of [4, -30, 22.5]) {
        const top = roofY(z) - 1.2;
        const branch = top - 3.6;
        shafts.push({ p: [x, (FLOOR + branch) / 2, z], s: [1, branch - FLOOR, 1] });
        for (const [dx, dz] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          struts.push(between([x, branch, z], [x + dx * 3, roofY(z + dz * 3) - 1.15, z + dz * 3], 1));
        }
      }
    }
    return { shafts, struts };
  }, []);
  const shaftGeo = useMemo(() => new CylinderGeometry(0.42, 0.5, 1, 20), []);
  const strutGeo = useMemo(() => new CylinderGeometry(0.2, 0.28, 1, 10), []);
  return (
    <group>
      <StaticInstances geometry={shaftGeo} material={m.white} items={items.shafts} castShadow />
      <StaticInstances geometry={strutGeo} material={m.white} items={items.struts} castShadow />
    </group>
  );
}

/* ------------------------------------------------------------------ check-in */

function CheckIn() {
  const m = mats();
  const islands = [
    { x: -36, name: "LATAM", sub: "Check-in 01–12 · Nacional / Internacional" },
    { x: -22, name: "GOL", sub: "Check-in 13–22 · Nacional / Internacional" },
    { x: 22, name: "AZUL", sub: "Check-in 23–34 · Nacional / Internacional" },
    { x: 36, name: "TAP · AEROLÍNEAS · COPA", sub: "Check-in 35–44 · Internacional" },
  ];
  const headerTex = useMemo(
    () => islands.map((i) => signTexture([{ text: i.name, sub: i.sub }], { w: 1024, h: 256, bg: "#16181c", fg: "#ffffff", accent: "rgba(255,255,255,0.6)" })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const { desks, belts, screens, posts, kiosks } = useMemo(() => {
    const d: Xform[] = [];
    const b: Xform[] = [];
    const sc: Xform[] = [];
    const p: Xform[] = [];
    const k: Xform[] = [];
    for (const is of islands) {
      for (let z = -9; z <= 1; z += 2.5) {
        for (const s of [-1, 1]) {
          d.push({ p: [is.x + s * 2.6, FLOOR + 0.55, z], s: [1.0, 1.1, 2.1] });
          b.push({ p: [is.x + s * 1.75, FLOOR + 0.35, z], s: [0.7, 0.7, 2.3] });
          sc.push({ p: [is.x + s * 2.4, FLOOR + 1.35, z + 0.6], r: [0, (s * Math.PI) / 2, 0], s: [0.5, 0.32, 0.03] });
        }
      }
      // queue stanchions
      for (const s of [-1, 1]) {
        for (let z = -9; z <= 2; z += 1.6) {
          p.push({ p: [is.x + s * 5.2, FLOOR + 0.5, z], s: [1, 1, 1] });
          p.push({ p: [is.x + s * 6.8, FLOOR + 0.5, z], s: [1, 1, 1] });
        }
      }
    }
    for (const x of [-15, -13, 13, 15]) for (const z of [9, 10.6]) k.push({ p: [x, FLOOR + 0.8, z], s: [0.6, 1.6, 0.5] });
    return { desks: d, belts: b, screens: sc, posts: p, kiosks: k };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const post = useMemo(() => new CylinderGeometry(0.035, 0.05, 1, 8), []);
  const beltTape = useMemo(() => new MeshStandardMaterial({ color: "#23324d", roughness: 0.6 }), []);

  return (
    <group>
      {islands.map((is, i) => (
        <group key={is.x} position={[is.x, FLOOR, -4]}>
          <mesh position={[0, 1.4, 0]} material={m.graphite} castShadow receiveShadow>
            <boxGeometry args={[2.2, 2.8, 13]} />
          </mesh>
          <mesh position={[0, 3.6, 0]} material={m.darkSteel} castShadow>
            <boxGeometry args={[2.4, 1.6, 13.4]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.22, 3.6, 0]} rotation-y={(s * Math.PI) / 2}>
              <planeGeometry args={[13, 1.3]} />
              <meshBasicMaterial map={headerTex[i]} toneMapped={false} color={new Color(1.35, 1.35, 1.35)} />
            </mesh>
          ))}
        </group>
      ))}
      <StaticInstances geometry={box} material={m.offWhite} items={desks} castShadow />
      <StaticInstances geometry={box} material={m.rubber} items={belts} />
      <StaticInstances geometry={box} material={m.screenGlow} items={screens} receiveShadow={false} />
      <StaticInstances geometry={post} material={m.steel} items={posts} />
      <StaticInstances geometry={box} material={m.graphite} items={kiosks} castShadow />
      <StaticInstances geometry={box} material={m.screenGlow} items={kiosks.map((k) => ({ p: [k.p[0], k.p[1] + 0.45, k.p[2] + 0.26], s: [0.45, 0.35, 0.02] }))} receiveShadow={false} />
      {/* queue tapes */}
      {islands.map((is) =>
        [-1, 1].map((s) => (
          <mesh key={is.x + "t" + s} position={[is.x + s * 6, FLOOR + 0.92, -3.5]} material={beltTape}>
            <boxGeometry args={[0.02, 0.05, 11]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ boards & signage */

function Boards() {
  const board = useMemo(() => new DeparturesBoard(BOARD_FLIGHTS), []);
  const m = mats();
  useFrame(() => {
    const p = journey.render;
    if (p > 0.1 && p < 0.4) board.update(Math.min(frame.delta, 0.05));
  });
  const signs = useMemo(
    () => ({
      gates: signTexture([{ text: "Embarque · Departures", sub: "Portões / Gates 1–16  ·  Controle de segurança", arrow: "up" }], { w: 1024, h: 220 }),
      left: signTexture([{ text: "Check-in 01–22", sub: "LATAM · GOL", arrow: "left" }], { w: 768, h: 220 }),
      right: signTexture([{ text: "Check-in 23–44", sub: "AZUL · TAP · Aerolíneas · Copa", arrow: "right" }], { w: 768, h: 220 }),
      security: signTexture([{ text: "Controle de Segurança · Security", sub: "Tenha seu cartão de embarque em mãos · Boarding pass ready" }], { w: 2048, h: 200 }),
      gate7: signTexture([{ text: "Portão 07 · Gate 07", sub: "PA 1923 · Voo panorâmico Porto Alegre · Embarque" }], { w: 1024, h: 220, fg: "#ffffff", accent: "#7ee08a" }),
      gate6: signTexture([{ text: "Portão 06 · Gate 06", sub: "Próximo voo · Next flight 16:40" }], { w: 1024, h: 220, fg: "#ffffff" }),
      aeromovel: signTexture([{ text: "Aeromóvel · Trensurb", sub: "Metrô / Metro connection", arrow: "left" }], { w: 768, h: 220 }),
    }),
    [],
  );
  const hang = (w: number, h: number) => new PlaneGeometry(w, h);
  return (
    <group>
      {/* main departures board */}
      <group position={[0, FLOOR + 7.4, -12]}>
        <mesh position={[0, 0, -0.12]} material={m.graphite} castShadow>
          <boxGeometry args={[9.6, 3.9, 0.22]} />
        </mesh>
        <mesh>
          <planeGeometry args={[9, 3.375]} />
          <meshBasicMaterial map={board.texture} toneMapped={false} color={new Color(1.5, 1.5, 1.5)} />
        </mesh>
        {[-3.8, 3.8].map((x) => (
          <mesh key={x} position={[x, 5, -0.12]} material={m.steel}>
            <cylinderGeometry args={[0.02, 0.02, 6.2, 6]} />
          </mesh>
        ))}
      </group>
      {/* side board facing the other way (seen from the security queue) */}
      <group position={[-30, FLOOR + 5.6, -13.5]} rotation-y={Math.PI}>
        <mesh>
          <planeGeometry args={[6, 2.25]} />
          <meshBasicMaterial map={board.texture} toneMapped={false} color={new Color(1.3, 1.3, 1.3)} />
        </mesh>
      </group>
      <mesh geometry={hang(5.6, 1.2)} position={[0, FLOOR + 5.2, 5]}>
        <meshBasicMaterial map={signs.gates} toneMapped={false} color={new Color(1.4, 1.4, 1.4)} />
      </mesh>
      <mesh geometry={hang(4.2, 1.2)} position={[-12, FLOOR + 5.2, 10]}>
        <meshBasicMaterial map={signs.left} toneMapped={false} color={new Color(1.4, 1.4, 1.4)} />
      </mesh>
      <mesh geometry={hang(4.2, 1.2)} position={[12, FLOOR + 5.2, 10]}>
        <meshBasicMaterial map={signs.right} toneMapped={false} color={new Color(1.4, 1.4, 1.4)} />
      </mesh>
      <mesh geometry={hang(4.2, 1.2)} position={[-60, FLOOR + 5.2, 8]} rotation-y={0.4}>
        <meshBasicMaterial map={signs.aeromovel} toneMapped={false} color={new Color(1.4, 1.4, 1.4)} />
      </mesh>
      <mesh geometry={hang(18, 1.75)} position={[0, FLOOR + 3.9, SECURITY_Z + 0.02]}>
        <meshBasicMaterial map={signs.security} toneMapped={false} color={new Color(1.4, 1.4, 1.4)} />
      </mesh>
      <mesh geometry={hang(4.4, 1)} position={[16, FLOOR + 3.6, GLASS_Z + 3.6]} rotation-y={0.25}>
        <meshBasicMaterial map={signs.gate7} toneMapped={false} color={new Color(1.4, 1.4, 1.4)} />
      </mesh>
      <mesh geometry={hang(4.4, 1)} position={[-16, FLOOR + 3.6, GLASS_Z + 3.6]} rotation-y={-0.25}>
        <meshBasicMaterial map={signs.gate6} toneMapped={false} color={new Color(1.4, 1.4, 1.4)} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ security */

function Security() {
  const m = mats();
  const archLights = useRef<MeshBasicMaterial>(null);
  const partition = useMemo(() => new MeshStandardMaterial({ color: "#dfe6ea", roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false }), []);
  const lanes = [-8, 0, 8];
  const rollers = useMemo(() => {
    const r: Xform[] = [];
    for (const x of lanes) for (let z = -15.2; z >= -24.8; z -= 0.28) r.push({ p: [x + 2.1, FLOOR + 0.82, z], r: [0, 0, Math.PI / 2], s: [1, 0.9, 1] });
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rollerGeo = useMemo(() => new CylinderGeometry(0.03, 0.03, 1, 6), []);

  useFrame(() => {
    const mat = archLights.current;
    if (!mat) return;
    const pass = window4(journey.render, 0.274, 0.279, 0.285, 0.292);
    mat.color.setRGB(0.3 + 0.2 * (1 - pass), 3 + 5 * pass, 0.8);
  });

  return (
    <group>
      {/* frosted partition with an opening for the lanes */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 37, FLOOR + 1.4, SECURITY_Z]} material={partition}>
          <boxGeometry args={[50, 2.8, 0.06]} />
        </mesh>
      ))}
      {lanes.map((x) => (
        <group key={x}>
          {/* walk-through detector */}
          <group position={[x, FLOOR, -20]}>
            {[-0.72, 0.72].map((dx) => (
              <mesh key={dx} position={[dx, 1.15, 0]} material={m.offWhite} castShadow>
                <boxGeometry args={[0.16, 2.3, 0.5]} />
              </mesh>
            ))}
            <mesh position={[0, 2.4, 0]} material={m.offWhite} castShadow>
              <boxGeometry args={[1.6, 0.2, 0.5]} />
            </mesh>
            <mesh position={[0, 2.17, 0.32]}>
              <boxGeometry args={[0.9, 0.05, 0.02]} />
              <meshBasicMaterial ref={x === 0 ? archLights : undefined} color={new Color(0.4, 3, 0.8)} toneMapped={false} />
            </mesh>
          </group>
          {/* X-ray machine */}
          <group position={[x + 2.1, FLOOR, -20]}>
            <mesh position={[0, 1.05, 0]} material={m.graphite} castShadow receiveShadow>
              <boxGeometry args={[1.25, 1.5, 2.6]} />
            </mesh>
            <mesh position={[0, 0.95, 1.31]} material={m.black}>
              <planeGeometry args={[0.8, 0.55]} />
            </mesh>
            <mesh position={[0, 0.4, 0]} material={m.darkSteel}>
              <boxGeometry args={[0.9, 0.8, 9.6]} />
            </mesh>
            <mesh position={[-0.9, 1.35, -1.9]} rotation-y={Math.PI / 2} material={m.screenGlow}>
              <planeGeometry args={[0.5, 0.35]} />
            </mesh>
          </group>
          {/* tray tables */}
          <mesh position={[x + 2.1, FLOOR + 0.9, -16.6]} material={m.darkSteel} receiveShadow>
            <boxGeometry args={[0.95, 0.04, 2.2]} />
          </mesh>
        </group>
      ))}
      <StaticInstances geometry={rollerGeo} material={m.steel} items={rollers} />
      {/* security officers' podiums */}
      {lanes.map((x) => (
        <mesh key={"pd" + x} position={[x - 1.4, FLOOR + 0.55, -21.8]} material={m.offWhite} castShadow>
          <boxGeometry args={[0.7, 1.1, 0.7]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ gate lounge */

function Lounge() {
  const m = mats();
  // bancos de espera, plantas e objetos vindos de modelos CC0
  const props = useMemo(() => {
    const bancos: Xform[] = [];
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        const z = -28.5 - row * 3.4;
        for (let i = 0; i < 5; i++) {
          const x = side * (8.5 + i * 1.95);
          // fileiras alternadas viradas para o vidro e para o corredor
          bancos.push({ p: [x, FLOOR, z], r: [0, row % 2 ? 0 : Math.PI, 0] });
        }
      }
    }
    const plantas: Xform[] = [
      { p: [-6.2, FLOOR, -33], r: [0, 0.7, 0] },
      { p: [6.2, FLOOR, -33], r: [0, -1.2, 0] },
      { p: [-6.2, FLOOR, -41], r: [0, 2.1, 0] },
      { p: [6.2, FLOOR, -41], r: [0, 0.3, 0] },
      { p: [-46, FLOOR, -30], r: [0, 1.1, 0] },
      { p: [46, FLOOR, -30], r: [0, -0.4, 0] },
      { p: [-20, FLOOR, 6], r: [0, 0.9, 0] },
      { p: [20, FLOOR, 6], r: [0, -0.9, 0] },
    ];
    const plantasBaixas: Xform[] = [
      { p: [-9.5, FLOOR, -26.5], r: [0, 0.4, 0] },
      { p: [9.5, FLOOR, -26.5], r: [0, -0.8, 0] },
      { p: [-13, FLOOR, 12], r: [0, 1.6, 0] },
      { p: [13, FLOOR, 12], r: [0, 0.2, 0] },
    ];
    const lixeiras: Xform[] = [
      { p: [-7.4, FLOOR, -30], r: [0, 0.3, 0] },
      { p: [7.4, FLOOR, -30], r: [0, -0.6, 0] },
      { p: [-7.4, FLOOR, -38], r: [0, 1.2, 0] },
      { p: [7.4, FLOOR, -38], r: [0, 0, 0] },
      { p: [-17, FLOOR, -14.5], r: [0, 0, 0] },
      { p: [17, FLOOR, -14.5], r: [0, 0.8, 0] },
      { p: [-10.5, FLOOR, 9], r: [0, 0.5, 0] },
      { p: [10.5, FLOOR, 9], r: [0, -0.5, 0] },
    ];
    const carrinhos: Xform[] = [
      { p: [-30, FLOOR, 11.5], r: [0, 0.2, 0] },
      { p: [-28.4, FLOOR, 11.5], r: [0, 0.2, 0] },
      { p: [33, FLOOR, 11.5], r: [0, -0.1, 0] },
    ];
    const placas: Xform[] = [
      { p: [3.2, FLOOR, -24.5], r: [0, 0.5, 0] },
      { p: [-26, FLOOR, 4], r: [0, -0.3, 0] },
    ];
    const mesas: Xform[] = [
      { p: [-62, FLOOR, -22.5], r: [0, 0.2, 0] },
      { p: [-58, FLOOR, -21.5], r: [0, -0.6, 0] },
      { p: [-54, FLOOR, -22.8], r: [0, 1.1, 0] },
      { p: [62, FLOOR, -22.5], r: [0, 0.4, 0] },
      { p: [58, FLOOR, -21.5], r: [0, -0.9, 0] },
    ];
    const cafe: Xform[] = [{ p: [-66, FLOOR, -23.5], r: [0, 1.5, 0] }];
    const extintores: Xform[] = [
      { p: [-9.5, FLOOR, -30.2], r: [0, 0, 0] },
      { p: [9.5, FLOOR, -30.2], r: [0, Math.PI, 0] },
      { p: [-9.5, FLOOR, 3.8], r: [0, 0, 0] },
      { p: [9.5, FLOOR, 3.8], r: [0, Math.PI, 0] },
    ];
    const relogios: Xform[] = [
      { p: [-9.5, FLOOR + 3.4, -16.1], r: [0, 0, 0] },
      { p: [9.5, FLOOR + 3.4, -16.1], r: [0, Math.PI, 0] },
    ];
    return { bancos, plantas, plantasBaixas, lixeiras, carrinhos, placas, mesas, cafe, extintores, relogios };
  }, []);

  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const shopSigns = useMemo(
    () => ["Café do Mercado", "Livraria", "Duty Free", "Chocolates Gramado", "Farmácia", "Artesanato Gaúcho"].map((t) => signTexture([{ text: t }], { w: 1024, h: 180, bg: "#0e0f11", fg: "#f3efe7" })),
    [],
  );
  return (
    <group>
      <InstancedModel url={MODELO.banco} items={porQualidade(props.bancos, 0.5)} />
      <InstancedModel url={MODELO.planta} items={porQualidade(props.plantas, 0.35)} />
      <InstancedModel url={MODELO.plantaBaixa} items={porQualidade(props.plantasBaixas, 0.5)} />
      <InstancedModel url={MODELO.lixeira} items={porQualidade(props.lixeiras, 0.5)} />
      <InstancedModel url={MODELO.carrinho} items={props.carrinhos} />
      <InstancedModel url={MODELO.placaPiso} items={props.placas} />
      <InstancedModel url={MODELO.mesaCadeiras} items={porQualidade(props.mesas, 0.5)} />
      <InstancedModel url={MODELO.carrinhoCafe} items={props.cafe} />
      <InstancedModel url={MODELO.extintor} items={props.extintores} shadows={false} />
      <InstancedModel url={MODELO.relogio} items={props.relogios} shadows={false} />
      {/* gate podiums */}
      {[-16, 16].map((x) => (
        <group key={x} position={[x, FLOOR, GLASS_Z + 5]}>
          <mesh position={[0, 0.55, 0]} material={m.wood} castShadow>
            <boxGeometry args={[2.4, 1.1, 0.8]} />
          </mesh>
          <mesh position={[0, 1.25, 0.1]} rotation-x={-0.4} material={m.screenGlow}>
            <planeGeometry args={[0.45, 0.3]} />
          </mesh>
        </group>
      ))}
      {/* shops along the airside concourse */}
      {[-1, 1].map((side) =>
        [0, 1, 2].map((i) => (
          <group key={side + "-" + i} position={[side * (70 + i * 14), FLOOR, -28]}>
            <mesh position={[0, 2.2, -1]} material={m.graphite} castShadow receiveShadow>
              <boxGeometry args={[12, 4.4, 10]} />
            </mesh>
            <mesh position={[0, 2, 4.02]} material={m.lightWarm}>
              <planeGeometry args={[10.4, 3.2]} />
            </mesh>
            <mesh position={[0, 3.9, 4.05]}>
              <planeGeometry args={[6, 0.9]} />
              <meshBasicMaterial map={shopSigns[(i + (side > 0 ? 3 : 0)) % shopSigns.length]} toneMapped={false} color={new Color(1.3, 1.3, 1.3)} />
            </mesh>
          </group>
        )),
      )}
      {/* planters */}
      {[-5, 5].map((x) => (
        <group key={x} position={[x, FLOOR, -36]}>
          <mesh position={[0, 0.4, 0]} material={m.darkConcrete}>
            <boxGeometry args={[1.4, 0.8, 6]} />
          </mesh>
          <mesh position={[0, 1.2, 0]} material={m.hedge} castShadow>
            <boxGeometry args={[1.2, 0.9, 5.6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}


/* ------------------------------------------------------------------ detalhes */

/** Malas de mão espalhadas junto de quem espera e de quem está na fila. */
function Bagagens() {
  const m = mats();
  const { corpos, alcas, rodas } = useMemo(() => {
    const r = mulberry32(4242);
    const c: Xform[] = [];
    const a: Xform[] = [];
    const w: Xform[] = [];
    const pontos: [number, number][] = [];
    // ao lado dos bancos da sala de embarque
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 5; i++) {
          if (r() < 0.45) continue;
          pontos.push([side * (8.2 + i * 1.95 + (r() - 0.5) * 0.6), -27.6 - row * 3.4 + (r() - 0.5) * 0.5]);
        }
      }
    }
    // nas filas de check-in e no saguão
    for (const ix of [-36, -22, 22, 36]) {
      for (const s2 of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          if (r() < 0.35) continue;
          pontos.push([ix + s2 * (5.2 + r() * 0.8), -8 + k * 1.7]);
        }
      }
    }
    for (const [x, z] of pontos) {
      const h = 0.52 + r() * 0.2;
      const wdt = 0.36 + r() * 0.1;
      const yaw = r() * Math.PI;
      c.push({ p: [x, FLOOR + h / 2 + 0.05, z], r: [0, yaw, 0], s: [wdt, h, 0.24] });
      a.push({ p: [x, FLOOR + h + 0.16, z], r: [0, yaw, 0], s: [0.05, 0.3, 0.04] });
      w.push({ p: [x, FLOOR + 0.04, z], r: [0, yaw, 0], s: [wdt * 0.8, 0.08, 0.2] });
    }
    return { corpos: c, alcas: a, rodas: w };
  }, []);
  const mala = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.06), []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const capa = useMemo(() => new MeshStandardMaterial({ color: "#2d3340", roughness: 0.75, metalness: 0.05 }), []);
  return (
    <group>
      <StaticInstances geometry={mala} material={capa} items={corpos} castShadow />
      <StaticInstances geometry={box} material={m.steel} items={alcas} />
      <StaticInstances geometry={box} material={m.rubber} items={rodas} />
    </group>
  );
}

/** Treliças, dutos e luminárias suspensas: o teto deixa de ser uma superfície vazia. */
function Estrutura() {
  const m = mats();
  const { vigas, diagonais, dutos, pendentes } = useMemo(() => {
    const v: Xform[] = [];
    const d: Xform[] = [];
    const du: Xform[] = [];
    const pe: Xform[] = [];
    for (let z = -44; z <= 12; z += 8) {
      const y = roofY(z) - 2.1;
      v.push({ p: [0, y, z], s: [HW * 2, 0.5, 0.3] });
      v.push({ p: [0, y - 1.1, z], s: [HW * 2, 0.3, 0.22] });
      for (let x = -HW + 4; x < HW; x += 6) {
        d.push({ p: [x, y - 0.55, z], r: [0, 0, 0.62], s: [0.16, 2.1, 0.16] });
        d.push({ p: [x + 3, y - 0.55, z], r: [0, 0, -0.62], s: [0.16, 2.1, 0.16] });
      }
    }
    for (const x of [-64, -30, 30, 64]) {
      du.push({ p: [x, roofY(-16) - 2.6, -16], r: [0, Math.PI / 2, 0], s: [0.9, 0.9, 56] });
    }
    for (let x = -96; x <= 96; x += 12) {
      for (const z of [-40, -30, -20, -8, 4]) {
        pe.push({ p: [x, roofY(z) - 3.4, z], s: [0.06, 2.2, 0.06] });
      }
    }
    return { vigas: v, diagonais: d, dutos: du, pendentes: pe };
  }, []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const tubo = useMemo(() => new CylinderGeometry(0.5, 0.5, 1, 12), []);
  return (
    <group>
      <StaticInstances geometry={box} material={m.steel} items={vigas} castShadow />
      <StaticInstances geometry={box} material={m.steel} items={diagonais} />
      <StaticInstances geometry={tubo} material={m.darkSteel} items={dutos} castShadow />
      <StaticInstances geometry={box} material={m.darkSteel} items={pendentes} />
    </group>
  );
}

/** Escadas rolantes ligando o desembarque ao saguão de embarque. */
function Escadas() {
  const m = mats();
  const { degraus, laterais } = useMemo(() => {
    const dg: Xform[] = [];
    const lat: Xform[] = [];
    const sobe = 4.6;
    const compr = 9.5;
    for (const [x, dir] of [
      [-44, 1],
      [-40, -1],
      [44, 1],
      [40, -1],
    ] as const) {
      const passos = 26;
      for (let i = 0; i < passos; i++) {
        const t = i / (passos - 1);
        dg.push({ p: [x, FLOOR - sobe + t * sobe + 0.15, 6 + dir * (compr / 2) - dir * t * compr], s: [1.05, 0.22, compr / passos + 0.06] });
      }
      for (const s2 of [-1, 1]) {
        lat.push({
          p: [x + s2 * 0.62, FLOOR - sobe / 2 + 0.6, 6],
          r: [Math.atan2(sobe, compr) * dir, 0, 0],
          s: [0.12, 1.0, Math.hypot(sobe, compr)],
        });
      }
    }
    return { degraus: dg, laterais: lat };
  }, []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const vidro = useMemo(() => new MeshStandardMaterial({ color: "#8fa5b4", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.35 }), []);
  return (
    <group>
      <StaticInstances geometry={box} material={m.steel} items={degraus} castShadow />
      <StaticInstances geometry={box} material={vidro} items={laterais} />
    </group>
  );
}

/* ------------------------------------------------------------------ jet bridge */

/**
 * Ponte de embarque: rotunda junto ao vidro, túnel telescópico com faixa de
 * janelas dos dois lados (o pátio e o avião aparecem lá fora), cabine de
 * comando e fole sanfonado até a porta L1. Tudo oco: a câmera atravessa a
 * cabine e o fole e entra no avião pela porta aberta.
 */
function JetBridge() {
  const m = mats();
  const { mid, len, yaw, pitch } = useMemo(() => {
    const [rx, rz] = BRIDGE.rotunda;
    const [cx, cz] = BRIDGE.cab;
    const total = Math.hypot(cx - rx, cz - rz);
    const ux = (cx - rx) / total;
    const uz = (cz - rz) / total;
    // do lado de fora da rotunda até um pouco dentro da cabine, para não atravessar os dois
    const a0 = 2.55;
    const a1 = total - 1.2;
    const ax = rx + ux * a0;
    const az = rz + uz * a0;
    const bx = rx + ux * a1;
    const bz = rz + uz * a1;
    const ya = BRIDGE.floorTop + ((BRIDGE.floorCab - BRIDGE.floorTop) * a0) / total;
    const yb = BRIDGE.floorTop + ((BRIDGE.floorCab - BRIDGE.floorTop) * a1) / total;
    const l = a1 - a0;
    return { mid: [(ax + bx) / 2, (ya + yb) / 2, (az + bz) / 2] as [number, number, number], len: l, yaw: Math.atan2(-(bx - ax), -(bz - az)), pitch: Math.atan2(yb - ya, l) };
  }, []);
  const mat = useMemo(
    () => ({
      parede: new MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.6, side: DoubleSide }),
      forro: new MeshStandardMaterial({ color: "#e4e2dc", roughness: 0.8, side: DoubleSide }),
      piso: new MeshStandardMaterial({ color: "#3b404b", roughness: 0.95 }),
      casca: new MeshStandardMaterial({ color: "#b3b8be", roughness: 0.5, metalness: 0.25, side: DoubleSide }),
      fole: new MeshStandardMaterial({ color: "#26282c", roughness: 0.9, side: DoubleSide }),
      soleira: new MeshStandardMaterial({ color: "#8a8f96", roughness: 0.35, metalness: 0.7 }),
    }),
    [],
  );
  const W = 2.4;
  const H = 2.6;
  const JAN0 = 0.95; // peitoril das janelas
  const JAN1 = 2.0; // topo das janelas
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);

  // nervuras da chapa externa e montantes das janelas, ao longo do túnel
  const { nervuras, montantes, corrimaos } = useMemo(() => {
    const nv: Xform[] = [];
    const mt: Xform[] = [];
    for (let z = -len / 2 + 0.3; z < len / 2 - 0.2; z += 0.42) {
      for (const s of [-1, 1]) {
        nv.push({ p: [s * (W / 2 + 0.2), JAN0 / 2, z], s: [0.04, JAN0, 0.06] });
        nv.push({ p: [s * (W / 2 + 0.2), (JAN1 + H) / 2, z], s: [0.04, H - JAN1, 0.06] });
      }
    }
    for (let z = -len / 2 + 0.6; z < len / 2; z += 1.35) for (const s of [-1, 1]) mt.push({ p: [s * (W / 2 + 0.05), (JAN0 + JAN1) / 2, z], s: [0.06, JAN1 - JAN0, 0.07] });
    const cr: Xform[] = [-1, 1].map((s) => ({ p: [s * (W / 2 - 0.07), 0.92, 0], s: [0.05, 0.05, len] }));
    return { nervuras: nv, montantes: mt, corrimaos: cr };
  }, [len]);

  // rotunda: paredes em dois arcos, abertas para o terminal e para o túnel
  const arcos = useMemo(() => {
    const entrada = -0.51; // de onde a câmera vem, pelo vão no vidro
    const tunel = Math.atan2(BRIDGE.cab[0] - BRIDGE.rotunda[0], BRIDGE.cab[1] - BRIDGE.rotunda[1]);
    const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const e0 = norm(entrada - 0.7);
    const e1 = norm(entrada + 0.7);
    const t0 = norm(tunel - 0.62);
    const t1 = norm(tunel + 0.62);
    return [
      { ini: e1, comp: norm(t0 - e1) },
      { ini: t1, comp: norm(e0 - t1) },
    ];
  }, []);

  return (
    <group>
      {/* rotunda */}
      <group position={[BRIDGE.rotunda[0], FLOOR, BRIDGE.rotunda[1]]}>
        {arcos.map((a, i) => (
          <group key={i}>
            <mesh position={[0, JAN0 / 2, 0]} material={mat.casca} castShadow>
              <cylinderGeometry args={[2.65, 2.65, JAN0, 24, 1, true, a.ini, a.comp]} />
            </mesh>
            <mesh position={[0, (JAN0 + JAN1) / 2, 0]} material={m.glass}>
              <cylinderGeometry args={[2.65, 2.65, JAN1 - JAN0, 24, 1, true, a.ini, a.comp]} />
            </mesh>
            <mesh position={[0, (JAN1 + H) / 2, 0]} material={mat.casca} castShadow>
              <cylinderGeometry args={[2.65, 2.65, H - JAN1, 24, 1, true, a.ini, a.comp]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, H + 0.2, 0]} material={mat.casca} castShadow>
          <cylinderGeometry args={[2.85, 2.85, 0.4, 24]} />
        </mesh>
        <mesh position={[0, H - 0.01, 0]} rotation-x={Math.PI / 2} material={mat.forro}>
          <circleGeometry args={[2.65, 24]} />
        </mesh>
        <mesh position={[0, H - 0.03, 0]} rotation-x={Math.PI / 2} material={m.lightPanel}>
          <ringGeometry args={[1.2, 1.45, 24]} />
        </mesh>
        <mesh position={[0, -0.05, 0]} material={mat.piso}>
          <cylinderGeometry args={[2.65, 2.65, 0.1, 24]} />
        </mesh>
        <mesh position={[0, -2.5, 0]} material={mat.casca} castShadow>
          <cylinderGeometry args={[0.45, 0.6, 5, 12]} />
        </mesh>
      </group>

      {/* túnel telescópico */}
      <group position={mid} rotation={[pitch, yaw, 0, "YXZ"]}>
        {/* piso, soleira de metal no meio (onde um tubo entra no outro) */}
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2} material={mat.piso}>
          <planeGeometry args={[W - 0.02, len]} />
        </mesh>
        <mesh position={[0, 0.03, len * 0.1]} material={mat.soleira}>
          <boxGeometry args={[W - 0.05, 0.02, 0.18]} />
        </mesh>
        <mesh position={[0, -0.17, 0]} material={mat.casca} castShadow>
          <boxGeometry args={[W + 0.45, 0.28, len]} />
        </mesh>
        {/* forro claro com duas linhas de luz */}
        <mesh position={[0, H, 0]} rotation-x={Math.PI / 2} material={mat.forro}>
          <planeGeometry args={[W, len]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={"l" + s} position={[s * 0.62, H - 0.03, 0]} material={m.lightPanel}>
            <boxGeometry args={[0.08, 0.02, len - 1]} />
          </mesh>
        ))}
        <mesh position={[0, H + 0.17, 0]} material={mat.casca} castShadow>
          <boxGeometry args={[W + 0.45, 0.28, len]} />
        </mesh>
        {/* paredes: rodapé e bandeira opacos, faixa de vidro no meio */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * (W / 2), JAN0 / 2, 0]} material={mat.parede}>
              <boxGeometry args={[0.04, JAN0, len]} />
            </mesh>
            <mesh position={[s * (W / 2), (JAN1 + H) / 2, 0]} material={mat.parede}>
              <boxGeometry args={[0.04, H - JAN1, len]} />
            </mesh>
            <mesh position={[s * (W / 2 + 0.05), (JAN0 + JAN1) / 2, 0]} rotation-y={Math.PI / 2} material={m.glass}>
              <planeGeometry args={[len, JAN1 - JAN0]} />
            </mesh>
            <mesh position={[s * (W / 2 + 0.2), JAN0 / 2, 0]} material={mat.casca} castShadow>
              <boxGeometry args={[0.03, JAN0, len]} />
            </mesh>
            <mesh position={[s * (W / 2 + 0.2), (JAN1 + H) / 2, 0]} material={mat.casca} castShadow>
              <boxGeometry args={[0.03, H - JAN1, len]} />
            </mesh>
          </group>
        ))}
        <StaticInstances geometry={box} material={mat.casca} items={nervuras} />
        <StaticInstances geometry={box} material={m.darkSteel} items={montantes} />
        <StaticInstances geometry={box} material={m.steel} items={corrimaos} />
        {/* aro onde o tubo menor entra no maior */}
        <group position={[0, 0, len * 0.1]}>
          <mesh position={[0, H + 0.36, 0]} material={mat.casca} castShadow>
            <boxGeometry args={[W + 0.7, 0.1, 0.14]} />
          </mesh>
          <mesh position={[0, -0.36, 0]} material={mat.casca}>
            <boxGeometry args={[W + 0.7, 0.1, 0.14]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (W / 2 + 0.3), H / 2, 0]} material={mat.casca}>
              <boxGeometry args={[0.1, H + 0.8, 0.14]} />
            </mesh>
          ))}
        </group>
        {/* unidade de tração */}
        <group position={[0, -2.4, len / 2 - 5]}>
          <mesh position={[0, 1.2, 0]} material={mat.casca}>
            <boxGeometry args={[0.5, 2.4, 0.5]} />
          </mesh>
          <mesh position={[0, 0.2, 0]} material={m.darkSteel} castShadow>
            <boxGeometry args={[2.6, 0.6, 1]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.1, -0.1, 0]} rotation-z={Math.PI / 2} material={m.rubber}>
              <cylinderGeometry args={[0.45, 0.45, 0.35, 16]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* cabine de comando: aberta para o túnel e para o avião */}
      <group position={[BRIDGE.cab[0] + 0.4, BRIDGE.floorCab, BRIDGE.cab[1]]}>
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2} material={mat.piso}>
          <planeGeometry args={[3.2, 3.4]} />
        </mesh>
        <mesh position={[0, -0.17, 0]} material={mat.casca} castShadow>
          <boxGeometry args={[3.4, 0.28, 3.6]} />
        </mesh>
        <mesh position={[0, H, 0]} rotation-x={Math.PI / 2} material={mat.forro}>
          <planeGeometry args={[3.2, 3.4]} />
        </mesh>
        <mesh position={[0, H + 0.17, 0]} material={mat.casca} castShadow>
          <boxGeometry args={[3.4, 0.28, 3.6]} />
        </mesh>
        <mesh position={[0, H - 0.03, 0]} material={m.lightPanel}>
          <boxGeometry args={[1.4, 0.02, 0.3]} />
        </mesh>
        {/* parede da frente (-z) com janela e o console do operador */}
        <mesh position={[0, JAN0 / 2, -1.7]} material={mat.parede}>
          <boxGeometry args={[3.2, JAN0, 0.05]} />
        </mesh>
        <mesh position={[0, (JAN1 + H) / 2, -1.7]} material={mat.parede}>
          <boxGeometry args={[3.2, H - JAN1, 0.05]} />
        </mesh>
        <mesh position={[0, (JAN0 + JAN1) / 2, -1.72]} material={m.glass}>
          <planeGeometry args={[3.2, JAN1 - JAN0]} />
        </mesh>
        <mesh position={[0.3, 0.55, -1.35]} material={m.graphite}>
          <boxGeometry args={[1.6, 1.1, 0.55]} />
        </mesh>
        <mesh position={[0.3, 1.12, -1.3]} rotation-x={-0.5} material={m.screenGlow}>
          <boxGeometry args={[0.5, 0.02, 0.3]} />
        </mesh>
        {/* parede lateral (+x) */}
        <mesh position={[1.6, H / 2, -0.55]} material={mat.parede}>
          <boxGeometry args={[0.05, H, 2.3]} />
        </mesh>
        <mesh position={[1.62, H / 2 + 0.05, -0.55]} material={mat.casca}>
          <boxGeometry args={[0.05, H + 0.3, 2.5]} />
        </mesh>
        {/* fole sanfonado até a fuselagem: arcos de borracha e lona escura, oco por dentro */}
        {[0, 1, 2, 3, 4].map((i) => {
          const x = -1.6 - i * 0.3;
          return (
            <group key={i} position={[x, 0, 0]}>
              <mesh position={[0, H + 0.02, 0]} material={m.rubber}>
                <boxGeometry args={[0.1, 0.12, 2.3]} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[0, H / 2, s * 1.1]} material={m.rubber}>
                  <boxGeometry args={[0.1, H + 0.1, 0.12]} />
                </mesh>
              ))}
            </group>
          );
        })}
        <mesh position={[-2.2, H + 0.02, 0]} rotation-x={Math.PI / 2} material={mat.fole}>
          <planeGeometry args={[1.25, 2.2]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[-2.2, H / 2, s * 1.1]} material={mat.fole}>
            <planeGeometry args={[1.25, H]} />
          </mesh>
        ))}
        {/* chapa de piso até a soleira da porta */}
        <mesh position={[-2.2, 0.025, 0]} material={mat.soleira}>
          <boxGeometry args={[1.25, 0.03, 1.9]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ light shafts */

function LightShafts() {
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(1.0, 0.9, 0.75),
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
        blending: 2,
        side: DoubleSide,
      }),
    [],
  );
  const ref = useRef<Group>(null);
  useFrame(() => {
    const d = frame.dir;
    mat.opacity = 0.055 * clamp(d.sunIntensity / 3) * frame.indoors;
    if (ref.current) {
      // lean shafts along the sun
      const tilt = Math.atan2(d.sunDir.x, d.sunDir.y);
      ref.current.children.forEach((c) => {
        c.rotation.z = tilt;
      });
    }
  });
  const xs = [-38, -19, 0, 19, 38];
  return (
    <group ref={ref}>
      {xs.map((x) => (
        <mesh key={x} position={[x, 14, -8]} material={mat}>
          <boxGeometry args={[1.8, 18, 46]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ terminal */

export default function Terminal() {
  const interior = useRef<Group>(null);
  const floorMap = floorTexture();
  const floorWear = floorWearTexture();
  useVisibleIn(interior, [[0.06, 0.52]], false);

  return (
    <group>
      <Roof />
      <Facade />
      <Columns />
      <JetBridge />
      <group ref={interior}>
        {journey.quality === "safe" ? (
          <PlainFloor size={[HW * 2, FACADE_Z - GLASS_Z]} position={[0, FLOOR + 0.001, (FACADE_Z + GLASS_Z) / 2]} map={floorMap} />
        ) : (
          <ReflectiveFloor size={[HW * 2, FACADE_Z - GLASS_Z]} position={[0, FLOOR + 0.001, (FACADE_Z + GLASS_Z) / 2]} map={floorMap} wear={floorWear} strength={0.32} resolution={journey.quality === "high" ? 768 : journey.quality === "medium" ? 512 : 256} />
        )}
        <CheckIn />
        <Boards />
        <Security />
        <Lounge />
        <Bagagens />
        <Estrutura />
        <Escadas />
        <LightShafts />
      </group>
      {/* lights stay outside the toggled group: changing the visible light count recompiles every shader */}
      <InteriorFill />
    </group>
  );
}

function PlainFloor({ size, position, map }: { size: [number, number]; position: [number, number, number]; map: import("three").Texture }) {
  const mat = useMemo(() => {
    const t = map.clone();
    t.repeat.set(size[0] / 9.6, size[1] / 9.6);
    t.needsUpdate = true;
    return new MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0 });
  }, [map, size]);
  return (
    <mesh position={position} rotation-x={-Math.PI / 2} material={mat} receiveShadow>
      <planeGeometry args={size} />
    </mesh>
  );
}

/** Soft bounce light that only exists while the camera is indoors (ambient: no shader cost). */
function InteriorFill() {
  const light = useRef<import("three").AmbientLight>(null);
  useFrame(() => {
    // no modo seguro não há mapa de ambiente, então o preenchimento compensa
    if (light.current) light.current.intensity = (journey.quality === "safe" ? 0.7 : 0.3) * frame.indoors;
  });
  return <ambientLight ref={light} color="#ffe6cc" intensity={0} />;
}
