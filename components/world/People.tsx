"use client";

import { mulberry32 } from "@/lib/math";

export type Agent = {
  kind: "walk" | "stand" | "sit" | "wave";
  a: [number, number, number];
  b?: [number, number, number];
  speed?: number;
  yaw?: number;
  seed: number;
  vest?: boolean;
  uniform?: boolean;
  bag?: boolean;
};

/** A multidão agora é feita de pessoas animadas; ver Pessoas.tsx. */
export { default } from "./Pessoas";

/* ------------------------------------------------------------------ populations */

export function landsideAgents(): Agent[] {
  const r = mulberry32(11);
  const out: Agent[] = [];
  for (let i = 0; i < 34; i++) {
    const x0 = (r() - 0.5) * 150;
    const z = 17.5 + r() * 5.5;
    if (Math.abs(x0) < 4) continue;
    if (r() < 0.55) out.push({ kind: "walk", a: [x0, 5, z], b: [x0 + (r() - 0.5) * 50, 5, z + (r() - 0.5) * 2], speed: 1 + r() * 0.5, seed: i, bag: r() < 0.6 });
    else out.push({ kind: "stand", a: [x0, 5, z], yaw: r() * 6.28, seed: i, bag: r() < 0.7 });
  }
  // traffic agents in vests near the kerb
  out.push({ kind: "stand", a: [-9, 5, 23.6], yaw: 1.2, seed: 901, vest: true });
  out.push({ kind: "walk", a: [18, 5, 23.4], b: [34, 5, 23.4], speed: 0.8, seed: 902, vest: true });
  return out;
}

export function hallAgents(): Agent[] {
  const r = mulberry32(21);
  const out: Agent[] = [];
  // travellers heading to security or the exits, in lanes that avoid the camera aisle
  for (let i = 0; i < 70; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const x = side * (5 + r() * 70);
    const z0 = 14 - r() * 6;
    out.push({ kind: "walk", a: [x, 5, z0], b: [x + (r() - 0.5) * 12, 5, -12 - r() * 3], speed: 1.05 + r() * 0.45, seed: 100 + i, bag: r() < 0.7 });
  }
  for (let i = 0; i < 18; i++) {
    const z = -10 - r() * 4;
    const x0 = 8 + r() * 30;
    const s = r() < 0.5 ? -1 : 1;
    out.push({ kind: "walk", a: [s * x0, 5, z], b: [s * (x0 + 25), 5, z], speed: 1.2 + r() * 0.3, seed: 200 + i, bag: r() < 0.4 });
  }
  // queues at check-in islands
  for (const ix of [-36, -22, 22, 36]) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        if (r() < 0.25) continue;
        out.push({ kind: "stand", a: [ix + s * (5.5 + r() * 0.8), 5, -8 + k * 1.7 + r() * 0.4], yaw: Math.PI + (r() - 0.5) * 0.6, seed: 300 + ix * 10 + k * s, bag: r() < 0.9 });
      }
      // airline agents behind the desks
      for (let k = 0; k < 3; k++) out.push({ kind: "stand", a: [ix + s * 3.35, 5, -8 + k * 4], yaw: (s * Math.PI) / 2, seed: 400 + ix * 10 + k * s, uniform: true });
    }
  }
  return out;
}

export function airsideAgents(): Agent[] {
  const r = mulberry32(31);
  const out: Agent[] = [];
  // security queue and officers
  for (const lx of [-8, 8]) {
    for (let k = 0; k < 5; k++) out.push({ kind: "stand", a: [lx + (r() - 0.5) * 0.4, 5, -14.5 + k * 1.2], yaw: Math.PI, seed: 500 + k + lx, bag: r() < 0.5 });
  }
  for (const lx of [-8, 0, 8]) out.push({ kind: "stand", a: [lx - 1.4, 5, -22.6], yaw: Math.PI / 2, seed: 520 + lx, uniform: true });
  // gate lounge: seated
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i < 14; i++) {
        if (r() < 0.45) continue;
        out.push({ kind: "sit", a: [side * (7 + i * 0.62), 5, -28 - row * 3 + 0.08], yaw: Math.PI, seed: 600 + row * 20 + i + (side > 0 ? 300 : 0) });
      }
    }
  }
  // concourse walkers
  for (let i = 0; i < 26; i++) {
    const z = -25 - r() * 18;
    const x0 = 44 + r() * 20;
    const s = r() < 0.5 ? -1 : 1;
    out.push({ kind: "walk", a: [s * x0, 5, z], b: [s * (x0 + 40), 5, z + (r() - 0.5) * 4], speed: 1.1 + r() * 0.4, seed: 900 + i, bag: r() < 0.6 });
  }
  // boarding queue at gate 07
  for (let k = 0; k < 7; k++) out.push({ kind: "stand", a: [11.5 + (r() - 0.5) * 0.3, 5, -40.5 - k * 0.75], yaw: Math.PI * 0.85, seed: 950 + k, bag: r() < 0.8 });
  out.push({ kind: "stand", a: [16, 5, -41.8], yaw: Math.PI * 0.2, seed: 970, uniform: true });
  return out;
}

export function rampAgents(): Agent[] {
  return [
    { kind: "walk", a: [-6, 0, -90], b: [-6, 0, -70], speed: 0.9, seed: 1001, vest: true },
    { kind: "stand", a: [5, 0, -94], yaw: 2.4, seed: 1002, vest: true },
    { kind: "walk", a: [9, 0, -84], b: [14, 0, -100], speed: 0.7, seed: 1003, vest: true },
    { kind: "stand", a: [-3, 0, -56], yaw: Math.PI, seed: 1004, vest: true },
    { kind: "stand", a: [-7.5, 0, -77], yaw: -1.2, seed: 1005, vest: true },
    { kind: "walk", a: [-20, 0, -120], b: [-8, 0, -104], speed: 1.1, seed: 1006, vest: true },
    // marshaller for the pushback
    { kind: "stand", a: [-16, 0, -150], yaw: 1.4, seed: 1007, vest: true },
  ];
}
