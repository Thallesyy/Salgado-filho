import { BufferGeometry, CanvasTexture, Float32BufferAttribute, LatheGeometry, SRGBColorSpace, Vector2 } from "three";

export type AirlinerSpec = {
  kind: "narrow" | "wide";
  zNose: number;
  zTail: number;
  radius: number;
  centerY: number;
  span: number; // half span from centreline
  rootLE: number; // z of wing root leading edge
  rootChord: number;
  tipChord: number;
  sweep: number; // radians
  dihedral: number;
  wingY: number;
  engineX: number;
  engineZ: number; // inlet z
  engineR: number;
  engineLen: number;
  engineY: number;
  mainGearX: number;
  noseGearZ: number;
  finRoot: number; // z of fin root LE
  finChord: number;
  finHeight: number;
  stabSpan: number;
};

export const NARROW: AirlinerSpec = {
  kind: "narrow",
  zNose: -17.5,
  zTail: 20,
  radius: 1.98,
  centerY: 4.3,
  span: 17.9,
  rootLE: -4.6,
  rootChord: 6.6,
  tipChord: 1.6,
  sweep: 0.44,
  dihedral: 0.09,
  wingY: 2.72,
  engineX: 5.75,
  engineZ: -7.6,
  engineR: 1.06,
  engineLen: 4.6,
  engineY: 2.15,
  mainGearX: 3.8,
  noseGearZ: -12.6,
  finRoot: 11.6,
  finChord: 6.8,
  finHeight: 6.2,
  stabSpan: 6.4,
};

export const WIDE: AirlinerSpec = {
  kind: "wide",
  zNose: -28,
  zTail: 30.8,
  radius: 2.82,
  centerY: 6.1,
  span: 30.1,
  rootLE: -9,
  rootChord: 11.5,
  tipChord: 2.6,
  sweep: 0.52,
  dihedral: 0.095,
  wingY: 4.35,
  engineX: 9.6,
  engineZ: -14,
  engineR: 1.65,
  engineLen: 6.6,
  engineY: 3.0,
  mainGearX: 5.4,
  noseGearZ: -22,
  finRoot: 19.5,
  finChord: 10.5,
  finHeight: 9.2,
  stabSpan: 9.8,
};

/** Fuselage radius and centre-line height offset along the body. */
export function fuselageSection(spec: AirlinerSpec, z: number) {
  const L = spec.zTail - spec.zNose;
  const noseLen = spec.radius * 3.1;
  const tailLen = L * 0.3;
  const t = z - spec.zNose;
  let r = spec.radius;
  let dy = 0;
  if (t < noseLen) {
    const u = t / noseLen;
    r = spec.radius * Math.pow(1 - Math.pow(1 - u, 2.4), 0.5);
    dy = -spec.radius * 0.18 * Math.pow(1 - u, 2);
  } else if (t > L - tailLen) {
    const u = (t - (L - tailLen)) / tailLen;
    r = spec.radius * (1 - 0.86 * Math.pow(u, 1.5));
    dy = spec.radius * 0.62 * Math.pow(u, 1.4);
  }
  return { r: Math.max(r, 0.02), dy };
}

/**
 * Fuselage as rings: u around (0 top, 0.25 +X, 0.5 belly, 0.75 −X),
 * v along (0 nose → 1 tail). Matches the livery painter in textures.ts.
 */
export function fuselageGeometry(spec: AirlinerSpec, rings = 90, sides = 48) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const L = spec.zTail - spec.zNose;
  for (let i = 0; i <= rings; i++) {
    const v = i / rings;
    // denser rings at the nose and tail
    const vv = v < 0.5 ? 0.5 * Math.pow(v * 2, 1.35) : 1 - 0.5 * Math.pow((1 - v) * 2, 1.35);
    const z = spec.zNose + vv * L;
    const { r, dy } = fuselageSection(spec, z);
    for (let j = 0; j <= sides; j++) {
      const u = j / sides;
      const th = u * Math.PI * 2;
      pos.push(Math.sin(th) * r, spec.centerY + dy + Math.cos(th) * r * 1.02, z);
      uv.push(u, 1 - (z - spec.zNose) / L);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Loft a closed profile between stations (each station = array of [x,y,z]). */
export function loft(stations: [number, number, number][][], capEnds = true) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = stations[0].length;
  stations.forEach((s) => s.forEach((p) => pos.push(...p)));
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * n + j;
      const b = i * n + ((j + 1) % n);
      const c = (i + 1) * n + j;
      const d = (i + 1) * n + ((j + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  }
  if (capEnds) {
    const last = (stations.length - 1) * n;
    for (let j = 1; j < n - 1; j++) {
      idx.push(0, j + 1, j);
      idx.push(last, last + j, last + j + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Airfoil loop in the chord plane: x = chordwise (0 LE → 1 TE), y = thickness. */
const AIRFOIL: [number, number][] = [
  [0, 0],
  [0.03, 0.5],
  [0.12, 0.9],
  [0.3, 1],
  [0.6, 0.72],
  [1, 0.05],
  [0.6, -0.28],
  [0.3, -0.42],
  [0.12, -0.38],
  [0.03, -0.22],
];

export function wingStation(le: [number, number, number], chord: number, thickness: number, axis: "z" | "y" = "z") {
  return AIRFOIL.map(([c, t]) => {
    if (axis === "z") return [le[0], le[1] + t * thickness * 0.5, le[2] + c * chord] as [number, number, number];
    return [le[0] + t * thickness * 0.5, le[1], le[2] + c * chord] as [number, number, number];
  });
}

export function wingGeometry(spec: AirlinerSpec, side: 1 | -1) {
  const stations: [number, number, number][][] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = spec.radius * 0.6 + t * (spec.span - spec.radius * 0.6);
    const chord = spec.rootChord + (spec.tipChord - spec.rootChord) * Math.pow(t, 0.85);
    const le: [number, number, number] = [side * x, spec.wingY + (x - spec.radius * 0.6) * Math.tan(spec.dihedral), spec.rootLE + (x - spec.radius * 0.6) * Math.tan(spec.sweep)];
    stations.push(wingStation(le, chord, chord * 0.12 * (1 - 0.35 * t)));
  }
  if (side < 0) stations.forEach((s) => s.reverse());
  return loft(stations);
}

export function stabGeometry(spec: AirlinerSpec, side: 1 | -1) {
  const stations: [number, number, number][][] = [];
  const rootChord = spec.finChord * 0.62;
  const baseY = spec.centerY + spec.radius * 0.55;
  const rootLE = spec.finRoot + spec.finChord * 0.18;
  for (let i = 0; i <= 2; i++) {
    const t = i / 2;
    const x = 0.2 + t * spec.stabSpan;
    const chord = rootChord * (1 - 0.6 * t);
    stations.push(wingStation([side * x, baseY + x * 0.1, rootLE + x * Math.tan(0.52)], chord, chord * 0.1));
  }
  if (side < 0) stations.forEach((s) => s.reverse());
  return loft(stations);
}

export function finGeometry(spec: AirlinerSpec) {
  const stations: [number, number, number][][] = [];
  const base = spec.centerY + spec.radius * 0.5;
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    const y = base + t * spec.finHeight;
    const chord = spec.finChord * (1 - 0.62 * t);
    stations.push(wingStation([0, y, spec.finRoot + t * spec.finHeight * Math.tan(0.62)], chord, chord * 0.11, "y"));
  }
  const g = loft(stations);
  // planar UV from the side for the tail artwork
  const p = g.getAttribute("position");
  const uv: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const y = p.getY(i);
    uv.push((z - spec.finRoot) / (spec.finChord + spec.finHeight * Math.tan(0.62)), (y - base) / spec.finHeight);
  }
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  return g;
}

export function nacelleGeometry(spec: AirlinerSpec) {
  const R = spec.engineR;
  const L = spec.engineLen;
  const pts = [
    new Vector2(R * 0.86, 0),
    new Vector2(R * 0.98, 0.05 * L),
    new Vector2(R, 0.18 * L),
    new Vector2(R * 0.97, 0.55 * L),
    new Vector2(R * 0.78, 0.86 * L),
    new Vector2(R * 0.58, L),
    new Vector2(R * 0.5, L),
    new Vector2(R * 0.84, 0.02 * L),
  ];
  const g = new LatheGeometry(pts, 36);
  g.rotateX(Math.PI / 2); // lathe axis Y → Z (inlet at local z=0, exhaust +Z)
  return g;
}

export function fanTexture() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#15171b";
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 22; i++) {
    ctx.rotate((Math.PI * 2) / 22);
    const g = ctx.createLinearGradient(0, 0, S / 2, 0);
    g.addColorStop(0, "#2a2e35");
    g.addColorStop(1, "#6b7079");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(S * 0.08, -2);
    ctx.quadraticCurveTo(S * 0.3, -14, S * 0.5, -6);
    ctx.lineTo(S * 0.5, 4);
    ctx.quadraticCurveTo(S * 0.3, -2, S * 0.08, 4);
    ctx.fill();
  }
  // spinner with the white swirl
  ctx.fillStyle = "#d9dadd";
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#16181c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 1.4; a += 0.05) {
    const r = (a / (Math.PI * 1.4)) * S * 0.1;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
