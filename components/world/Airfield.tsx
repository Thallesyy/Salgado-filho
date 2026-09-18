"use client";

import { useMemo } from "react";
import { BoxGeometry, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, type Texture } from "three";
import { mats } from "@/lib/materials";
import { aplicarPbr, PBR, usePbr, type Pbr, type PbrId } from "@/lib/pbr";
import { apronTexture, runwayBodyTexture, runwayEndTexture, taxiwayTexture } from "@/lib/textures";
import { APRON, RUNWAY, TAXIWAY_Z } from "@/lib/world";
import LightPoints, { type LightSpec } from "./LightPoints";

const decal = (map: Texture, level: number, roughness = 0.85, pbr: Pbr = {}, id: PbrId = PBR.asfalto) =>
  aplicarPbr(
    new MeshStandardMaterial({
      map,
      roughness,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1 * level,
      polygonOffsetUnits: -4 * level,
    }),
    pbr,
    id,
    0.8,
  );

/** A strip of surface from (x0,z0) to (x1,z1) with a texture repeating every `tile` metres along it. */
function Strip({ from, to, width, map, tile, level, y = 0.02, grao = PBR.asfalto }: { from: [number, number]; to: [number, number]; width: number; map: Texture; tile: number; level: number; y?: number; grao?: PbrId }) {
  const comprimento = Math.hypot(to[0] - from[0], to[1] - from[1]);
  // o relevo fotografado repete a cada 5 m, independente do tamanho da faixa
  const pbr = usePbr(grao, [width / 5, comprimento / 5]);
  const { geo, mat, pos, rot } = useMemo(() => {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const len = Math.hypot(dx, dz);
    const g = new PlaneGeometry(width, len);
    g.rotateX(-Math.PI / 2);
    const t = map.clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(1, len / tile);
    t.needsUpdate = true;
    return {
      geo: g,
      mat: decal(t, level, 0.85, pbr),
      pos: [(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2] as [number, number, number],
      // plane's local -Z (after rotateX) points along +v; align it with the strip direction
      rot: Math.atan2(-dx, -dz),
    };
  }, [from, to, width, map, tile, level, y, pbr]);
  return <mesh geometry={geo} material={mat} position={pos} rotation-y={rot} receiveShadow />;
}

function RunwayEnd({ x, dir, designator }: { x: number; dir: 1 | -1; designator: string }) {
  // dir = +1: runway continues toward -X from this threshold (the "29" end at the east)
  const pbr = usePbr(PBR.asfalto, [RUNWAY.width / 5, 80]);
  const { geo, mat } = useMemo(() => {
    const g = new PlaneGeometry(RUNWAY.width, 400);
    g.rotateX(-Math.PI / 2);
    return { geo: g, mat: decal(runwayEndTexture(designator), 3, 0.8, pbr) };
  }, [designator, pbr]);
  // v = 1 is the threshold; plane +v points along local -Z → rotate so -Z faces the threshold
  return <mesh geometry={geo} material={mat} position={[x - dir * 200, 0.06, RUNWAY.z]} rotation-y={dir > 0 ? -Math.PI / 2 : Math.PI / 2} receiveShadow />;
}

function Tower() {
  const m = mats();
  return (
    <group position={[-165, 0, -38]}>
      <mesh position={[0, 21, 0]} material={m.concrete} castShadow receiveShadow>
        <cylinderGeometry args={[2.4, 3.6, 42, 24]} />
      </mesh>
      <mesh position={[0, 41.5, 0]} material={m.darkConcrete} castShadow>
        <cylinderGeometry args={[6.4, 3, 3, 8]} />
      </mesh>
      <mesh position={[0, 45.5, 0]} material={m.tintedGlass}>
        <cylinderGeometry args={[6.8, 6.2, 5, 8, 1, true]} />
      </mesh>
      <mesh position={[0, 45.2, 0]} material={m.lightPanel}>
        <cylinderGeometry args={[5.6, 5.6, 1.2, 8]} />
      </mesh>
      <mesh position={[0, 48.5, 0]} material={m.graphite} castShadow>
        <cylinderGeometry args={[4.5, 7.2, 1.2, 8]} />
      </mesh>
      <mesh position={[0, 53, 0]} material={m.steel}>
        <cylinderGeometry args={[0.12, 0.2, 8, 6]} />
      </mesh>
      <mesh position={[0, 57.1, 0]} material={m.red}>
        <sphereGeometry args={[0.35, 8, 8]} />
      </mesh>
    </group>
  );
}

function Hangar({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  const m = mats();
  const [w, h, d] = size;
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} material={m.offWhite} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh position={[0, h, 0]} rotation-z={Math.PI / 2} material={m.steel} castShadow>
        <cylinderGeometry args={[d / 2, d / 2, w, 24, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, h * 0.42, -d / 2 - 0.05]} material={m.darkSteel}>
        <planeGeometry args={[w * 0.9, h * 0.84]} />
      </mesh>
    </group>
  );
}

export default function Airfield() {
  const m = mats();
  const rwyBody = runwayBodyTexture();
  const twy = taxiwayTexture();
  const apron = apronTexture();

  const apronPbr = usePbr(PBR.concreto, [(APRON.x1 - APRON.x0) / 6, (APRON.z0 - APRON.z1) / 6]);
  const apronMat = useMemo(() => {
    const t = apron.clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set((APRON.x1 - APRON.x0) / 60, (APRON.z0 - APRON.z1) / 60);
    t.needsUpdate = true;
    return decal(t, 1, 0.9, apronPbr, PBR.concreto);
  }, [apron, apronPbr]);

  const lights = useMemo(() => {
    const L: LightSpec[] = [];
    const W = [3.5, 3.3, 2.9] as [number, number, number];
    const Y = [4, 2.6, 0.6] as [number, number, number];
    const G = [0.4, 4, 1.2] as [number, number, number];
    const R = [4.5, 0.25, 0.2] as [number, number, number];
    const B = [0.5, 0.9, 5] as [number, number, number];
    // runway edge (last 600 m yellow)
    for (let x = RUNWAY.x0; x <= RUNWAY.x1; x += 60) {
      const yellowFor29 = x < RUNWAY.x0 + 600;
      for (const s of [-1, 1]) L.push({ pos: [x, 0.4, RUNWAY.z + s * (RUNWAY.width / 2 + 1.5)], color: yellowFor29 ? Y : W, size: 0.5 });
    }
    // centreline
    for (let x = RUNWAY.x0 + 15; x < RUNWAY.x1; x += 30) L.push({ pos: [x, 0.12, RUNWAY.z], color: x < RUNWAY.x0 + 900 ? R : W, size: 0.35 });
    // thresholds / ends
    for (let z = -22; z <= 22; z += 3) {
      L.push({ pos: [RUNWAY.x1 + 2, 0.3, RUNWAY.z + z], color: G, size: 0.55 });
      L.push({ pos: [RUNWAY.x0 - 2, 0.3, RUNWAY.z + z], color: G, size: 0.55 });
      L.push({ pos: [RUNWAY.x1 - 1, 0.3, RUNWAY.z + z], color: R, size: 0.45 });
      L.push({ pos: [RUNWAY.x0 + 1, 0.3, RUNWAY.z + z], color: R, size: 0.45 });
    }
    // approach lighting east of runway 29, with sequenced flashers
    for (let d = 30; d <= 900; d += 30) {
      const x = RUNWAY.x1 + d;
      for (let k = -2; k <= 2; k++) L.push({ pos: [x, 1.5 + d * 0.004, RUNWAY.z + k * 1.1], color: W, size: 0.5 });
      if (d % 150 === 0) for (let k = -8; k <= 8; k++) L.push({ pos: [x, 1.5 + d * 0.004, RUNWAY.z + k * 1.6], color: W, size: 0.45 });
      L.push({ pos: [x, 2.2 + d * 0.004, RUNWAY.z], color: [8, 8, 8], size: 0.9, blink: 2 });
    }
    // PAPI
    for (let i = 0; i < 4; i++) L.push({ pos: [RUNWAY.x1 - 320, 0.8, RUNWAY.z + RUNWAY.width / 2 + 14 + i * 9], color: i < 2 ? W : R, size: 0.8 });
    // taxiway edges (blue) and centreline (green)
    for (let x = RUNWAY.x0; x <= RUNWAY.x1 + 80; x += 45) {
      L.push({ pos: [x, 0.35, TAXIWAY_Z - 12.5], color: B, size: 0.4 });
      L.push({ pos: [x, 0.35, TAXIWAY_Z + 12.5], color: B, size: 0.4 });
      L.push({ pos: [x + 22, 0.1, TAXIWAY_Z], color: G, size: 0.28 });
    }
    for (let z = -410; z <= -165; z += 30) {
      L.push({ pos: [668, 0.35, z], color: B, size: 0.4 });
      L.push({ pos: [692, 0.35, z], color: B, size: 0.4 });
    }
    // apron floodlight masts
    for (const x of [-300, -150, 150, 300]) {
      for (let k = -1; k <= 1; k++) L.push({ pos: [x + k * 1.4, 30, -236], color: [6, 5.2, 4.2], size: 1.1 });
    }
    // obstruction lights on hangars & tower
    L.push({ pos: [360, 24, -100], color: R, size: 0.8, blink: 0.8 });
    L.push({ pos: [-560, 16, -140], color: R, size: 0.8, blink: 0.8 });
    return L;
  }, []);

  const standLines = useMemo(() => {
    const g = new BoxGeometry(0.25, 0.02, 1);
    return { g, mat: new MeshStandardMaterial({ color: "#e3b43c", roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }) };
  }, []);

  return (
    <group>
      {/* runway 11/29 */}
      <Strip from={[RUNWAY.x0 + 400, RUNWAY.z]} to={[RUNWAY.x1 - 400, RUNWAY.z]} width={RUNWAY.width} map={rwyBody} tile={100} level={3} y={0.06} />
      <RunwayEnd x={RUNWAY.x1} dir={1} designator="29" />
      <RunwayEnd x={RUNWAY.x0} dir={-1} designator="11" />
      {/* shoulders */}
      <Strip from={[RUNWAY.x0 - 60, RUNWAY.z]} to={[RUNWAY.x1 + 60, RUNWAY.z]} width={RUNWAY.width + 18} map={twy} tile={400} level={2} y={0.04} />

      {/* parallel taxiway & connectors */}
      <Strip from={[RUNWAY.x0, TAXIWAY_Z]} to={[RUNWAY.x1 + 90, TAXIWAY_Z]} width={23} map={twy} tile={50} level={2} y={0.05} />
      {[RUNWAY.x0 + 40, -1800, -1100, -420].map((x) => (
        <Strip key={x} from={[x, RUNWAY.z + 20]} to={[x + 90, TAXIWAY_Z - 11]} width={23} map={twy} tile={50} level={2} y={0.05} />
      ))}
      <Strip from={[680, RUNWAY.z + 20]} to={[680, -150]} width={26} map={twy} tile={50} level={2} y={0.05} />
      <Strip from={[-260, TAXIWAY_Z + 11]} to={[-260, APRON.z1]} width={23} map={twy} tile={50} level={2} y={0.05} />
      <Strip from={[260, TAXIWAY_Z + 11]} to={[260, APRON.z1]} width={23} map={twy} tile={50} level={2} y={0.05} />
      {/* taxilane along the apron edge toward the east connector */}
      <Strip from={[APRON.x0, -162]} to={[700, -162]} width={30} map={twy} tile={50} level={2} y={0.055} />

      {/* apron */}
      <mesh position={[(APRON.x0 + APRON.x1) / 2, 0.03, (APRON.z0 + APRON.z1) / 2]} rotation-x={-Math.PI / 2} material={apronMat} receiveShadow>
        <planeGeometry args={[APRON.x1 - APRON.x0, APRON.z0 - APRON.z1]} />
      </mesh>
      {/* stand lead-in lines & stop bars */}
      {[-150, -75, 0, 75, 150].map((x) => (
        <group key={x}>
          <mesh geometry={standLines.g} material={standLines.mat} position={[x, 0.05, -100]} scale={[1, 1, 100]} />
          <mesh geometry={standLines.g} material={standLines.mat} position={[x, 0.05, -60]} scale={[16, 1, 0.5]} />
        </group>
      ))}
      <mesh geometry={standLines.g} material={standLines.mat} position={[0, 0.05, -238]} scale={[2400, 1, 1]} rotation-y={Math.PI / 2} />

      {/* buildings on the airfield */}
      <Tower />
      <Hangar position={[360, 0, -100]} size={[90, 20, 70]} />
      <Hangar position={[470, 0, -100]} size={[70, 16, 60]} />
      <group position={[-560, 0, -140]}>
        <mesh position={[0, 7, 0]} material={m.offWhite} castShadow receiveShadow>
          <boxGeometry args={[220, 14, 90]} />
        </mesh>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} position={[-97 + i * 15, 3, -45.1]} material={m.darkSteel}>
            <planeGeometry args={[9, 5.5]} />
          </mesh>
        ))}
        <mesh position={[0, 12, -45.2]} material={m.graphite}>
          <planeGeometry args={[80, 2.6]} />
        </mesh>
      </group>
      {/* localizer array beyond runway 11 end */}
      <group position={[RUNWAY.x0 - 300, 0, RUNWAY.z]}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} position={[0, 1.6, -26 + i * 4]} material={m.white}>
            <boxGeometry args={[0.3, 3.2, 0.3]} />
          </mesh>
        ))}
      </group>
      {/* apron light masts */}
      {[-300, -150, 150, 300].map((x) => (
        <mesh key={x} position={[x, 15, -238]} material={m.steel} castShadow>
          <cylinderGeometry args={[0.35, 0.6, 30, 8]} />
        </mesh>
      ))}
      <LightPoints lights={lights} day={0.35} night={1.2} />
    </group>
  );
}
