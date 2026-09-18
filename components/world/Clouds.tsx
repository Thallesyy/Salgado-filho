"use client";

import { Cloud, Clouds } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Group, MeshLambertMaterial } from "three";
import { frame } from "@/lib/frame";
import { smoothstep } from "@/lib/math";
import { journey } from "@/lib/journey";
import { mulberry32 } from "@/lib/math";
import { cloudSpriteDataURL } from "@/lib/textures";

/**
 * Sprite-volume cumulus (drei <Clouds>) lit by the sun and hemisphere, so
 * they turn gold and violet at sunset. Banks sit around the flight loop,
 * with a scattered layer on the climb-out that the aircraft flies through.
 */
const cloudGlow = new Color(0.3, 0.32, 0.36);
/** Lambert clouds whose emissive colour is shared, so the sky tint reaches every instance. */
class CloudMaterial extends MeshLambertMaterial {
  constructor() {
    super();
    this.emissive = cloudGlow;
  }
}

export default function CloudLayer() {
  const group = useRef<Group>(null);
  const texture = useMemo(() => cloudSpriteDataURL(), []);
  const banks = useMemo(() => {
    const r = mulberry32(606);
    const list: { pos: [number, number, number]; bounds: [number, number, number]; segments: number; seed: number; volume: number; opacity: number }[] = [];
    // climb-out scattered layer
    for (let i = 0; i < 6; i++) list.push({ pos: [-3800 - i * 700 + r() * 300, 380 + r() * 140, -500 + (r() - 0.5) * 900], bounds: [260, 60, 180], segments: 14, seed: i, volume: 160, opacity: 0.75 });
    // banks around the city loop, slightly above and below the flight level
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rx = 7600 + r() * 3000;
      const rz = 6500 + r() * 2500;
      list.push({
        pos: [-2000 + Math.cos(a) * rx, 1150 + r() * 700, 4200 + Math.sin(a) * rz],
        bounds: [900, 160, 600],
        segments: 22,
        seed: 100 + i,
        volume: 520,
        opacity: 0.9,
      });
    }
    // distant sunset line over the far bank of the Guaíba
    for (let i = 0; i < 8; i++) list.push({ pos: [-17000 - r() * 3000, 1400 + r() * 500, -6000 + i * 2400], bounds: [1600, 220, 900], segments: 18, seed: 300 + i, volume: 900, opacity: 0.95 });
    return list;
  }, []);

  const tint = useMemo(() => ({ day: new Color(0.45, 0.47, 0.52), gold: new Color(1.7, 0.95, 0.62), dusk: new Color(0.95, 0.62, 0.78) }), []);
  useFrame(() => {
    const g = group.current;
    const p = journey.render;
    if (!g) return;
    g.visible = p > 0.6 || journey.finaleRender > 0;
    if (!g.visible) return;
    // clouds glow with the sky: self-lit tint so they never read as dark blots at dusk
    const d = frame.dir;
    const gold = smoothstep(20, 2, d.sunElevation);
    cloudGlow.copy(tint.day).lerp(tint.gold, gold).lerp(tint.dusk, d.night);
  });

  return (
    <group ref={group}>
      <Clouds material={CloudMaterial} texture={texture} limit={journey.quality === "safe" ? 180 : 420} frustumCulled={false}>
        {banks.filter((_, i) => journey.quality !== "safe" || i % 2 === 0).map((b, i) => (
          <Cloud key={i} position={b.pos} bounds={b.bounds} segments={b.segments} seed={b.seed} volume={b.volume} opacity={b.opacity} growth={4} speed={0.05} color="#ffffff" fade={4000} />
        ))}
      </Clouds>
    </group>
  );
}
