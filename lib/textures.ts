import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";
import { mulberry32 } from "./math";

/* All textures are painted at runtime, no image assets are downloaded. */

const fontVar = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
};
export const FONT_SANS = () => fontVar("--nf-sans", "Helvetica, Arial, sans-serif");
export const FONT_MONO = () => fontVar("--nf-mono", "Menlo, monospace");

function make(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function tex(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean; clamp?: boolean } = {}) {
  const t = new CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? NoColorSpace : SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = LinearMipmapLinearFilter;
  if (!opts.clamp) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
  } else {
    t.wrapS = ClampToEdgeWrapping;
    t.wrapT = ClampToEdgeWrapping;
  }
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  return t;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const r = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, color: string, maxR: number, seed: number) {
  const r = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = maxR * (0.2 + r() * 0.8);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

const cache = new Map<string, Texture>();
function cached<T extends Texture>(key: string, fn: () => T): T {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key) as T;
}

/* ---------------------------------------------------------------- runway */

/** 45 m × 100 m tile (u across, v along) */
export const runwayBodyTexture = () =>
  cached("rwy-body", () => {
    const W = 256, H = 1024;
    const { c, ctx } = make(W, H);
    ctx.fillStyle = "#3b3c3e";
    ctx.fillRect(0, 0, W, H);
    blotches(ctx, W, H, 40, "rgba(20,20,22,0.25)", 60, 3);
    blotches(ctx, W, H, 30, "rgba(90,90,92,0.12)", 50, 4);
    noise(ctx, W, H, 30, 5);
    const pxm = W / 45; // px per metre across
    const pvm = H / 100; // px per metre along
    ctx.fillStyle = "#e8e8e2";
    // centreline: 30 m stripe, 20 m gap
    ctx.fillRect(W / 2 - 0.45 * pxm, 10 * pvm, 0.9 * pxm, 30 * pvm);
    ctx.fillRect(W / 2 - 0.45 * pxm, 60 * pvm, 0.9 * pxm, 30 * pvm);
    // side stripes
    ctx.fillRect(1.2 * pxm, 0, 0.9 * pxm, H);
    ctx.fillRect(W - 2.1 * pxm, 0, 0.9 * pxm, H);
    // centreline rubber
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0.3, "rgba(0,0,0,0)");
    g.addColorStop(0.42, "rgba(15,15,15,0.28)");
    g.addColorStop(0.5, "rgba(15,15,15,0.1)");
    g.addColorStop(0.58, "rgba(15,15,15,0.28)");
    g.addColorStop(0.7, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return tex(c, { repeat: [1, 1] });
  });

/** 45 m × 400 m runway end with threshold, designator and touchdown zone */
export const runwayEndTexture = (designator: string) =>
  cached("rwy-end-" + designator, () => {
    const W = 512, H = 2048;
    const { c, ctx } = make(W, H);
    ctx.fillStyle = "#3b3c3e";
    ctx.fillRect(0, 0, W, H);
    blotches(ctx, W, H, 90, "rgba(20,20,22,0.22)", 90, 7);
    noise(ctx, W, H, 28, 8);
    const pxm = W / 45;
    const pvm = H / 400;
    // tyre rubber in the touchdown zone
    const r = mulberry32(11);
    for (let i = 0; i < 260; i++) {
      const x = W / 2 + (r() - 0.5) * 16 * pxm + (r() > 0.5 ? 1 : -1) * 3.5 * pxm;
      const y = (150 + r() * 220) * pvm;
      ctx.fillStyle = `rgba(12,12,12,${0.05 + r() * 0.12})`;
      ctx.fillRect(x, y, (0.6 + r()) * pxm, (8 + r() * 40) * pvm);
    }
    ctx.fillStyle = "#ecece6";
    // threshold bar + piano keys (12 stripes for 45 m)
    ctx.fillRect(0, 5 * pvm, W, 1.5 * pvm);
    const stripeW = 1.8 * pxm;
    for (let i = 0; i < 6; i++) {
      const off = (3 + i * 3.4) * pxm;
      ctx.fillRect(W / 2 - off - stripeW, 12 * pvm, stripeW, 30 * pvm);
      ctx.fillRect(W / 2 + off, 12 * pvm, stripeW, 30 * pvm);
    }
    // designator (reads from the approach)
    ctx.save();
    ctx.translate(W / 2, 60 * pvm);
    // canvas top maps to the threshold edge (v = 1); rotate so the numerals read upright from the approach
    ctx.rotate(Math.PI);
    ctx.scale(1, (pvm / pxm) * 2.2);
    ctx.font = `700 ${Math.round(9.5 * pxm)}px ${FONT_SANS()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(designator, 0, 0);
    ctx.restore();
    // centreline dashes
    for (let s = 90; s < 400; s += 50) ctx.fillRect(W / 2 - 0.45 * pxm, s * pvm, 0.9 * pxm, 30 * pvm);
    // aiming point
    ctx.fillRect(W / 2 - 9 * pxm, 300 * pvm, 4 * pxm, 45 * pvm);
    ctx.fillRect(W / 2 + 5 * pxm, 300 * pvm, 4 * pxm, 45 * pvm);
    // touchdown zone pairs
    for (const s of [150, 450 - 250]) {
      for (let j = 0; j < 3; j++) {
        ctx.fillRect(W / 2 - (6 + j * 2.4) * pxm, s * pvm, 1.8 * pxm, 22 * pvm);
        ctx.fillRect(W / 2 + (4.2 + j * 2.4) * pxm, s * pvm, 1.8 * pxm, 22 * pvm);
      }
    }
    ctx.fillRect(1.2 * pxm, 0, 0.9 * pxm, H);
    ctx.fillRect(W - 2.1 * pxm, 0, 0.9 * pxm, H);
    return tex(c, { clamp: true });
  });

/** taxiway 23 m × 50 m */
export const taxiwayTexture = () =>
  cached("twy", () => {
    const W = 128, H = 256;
    const { c, ctx } = make(W, H);
    ctx.fillStyle = "#454546";
    ctx.fillRect(0, 0, W, H);
    blotches(ctx, W, H, 14, "rgba(20,20,20,0.2)", 30, 21);
    noise(ctx, W, H, 26, 22);
    const pxm = W / 23;
    ctx.fillStyle = "#e0b43a";
    ctx.fillRect(W / 2 - 0.12 * pxm, 0, 0.3 * pxm, H);
    ctx.fillRect(0.5 * pxm, 0, 0.18 * pxm, H);
    ctx.fillRect(0.9 * pxm, 0, 0.18 * pxm, H);
    ctx.fillRect(W - 0.68 * pxm, 0, 0.18 * pxm, H);
    ctx.fillRect(W - 1.08 * pxm, 0, 0.18 * pxm, H);
    return tex(c);
  });

/** apron concrete, 60 m tile with 5 m slabs */
export const apronTexture = () =>
  cached("apron", () => {
    const S = 1024;
    const { c, ctx } = make(S, S);
    const r = mulberry32(31);
    const slab = S / 12;
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++) {
        const l = 150 + r() * 14;
        ctx.fillStyle = `rgb(${l},${l - 2},${l - 6})`;
        ctx.fillRect(i * slab, j * slab, slab, slab);
      }
    blotches(ctx, S, S, 60, "rgba(40,36,30,0.18)", 40, 32);
    blotches(ctx, S, S, 25, "rgba(20,20,20,0.25)", 18, 33);
    noise(ctx, S, S, 22, 34);
    ctx.strokeStyle = "rgba(60,58,55,0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(i * slab, 0);
      ctx.lineTo(i * slab, S);
      ctx.moveTo(0, i * slab);
      ctx.lineTo(S, i * slab);
      ctx.stroke();
    }
    return tex(c);
  });

/** road asphalt, 14 m wide × 24 m, 4 lanes */
export const roadTexture = () =>
  cached("road", () => {
    const W = 256, H = 256;
    const { c, ctx } = make(W, H);
    // asfalto já gasto pelo sol: cinza médio levemente quente, não preto
    ctx.fillStyle = "#58575a";
    ctx.fillRect(0, 0, W, H);
    blotches(ctx, W, H, 20, "rgba(25,24,22,0.22)", 40, 41);
    noise(ctx, W, H, 34, 42);
    const pxm = W / 14;
    ctx.fillStyle = "#dcdcd4";
    ctx.fillRect(0.3 * pxm, 0, 0.15 * pxm, H);
    ctx.fillRect(W - 0.45 * pxm, 0, 0.15 * pxm, H);
    for (const lane of [3.5, 10.5]) {
      ctx.fillRect(lane * pxm, 0, 0.15 * pxm, H * 0.35);
      ctx.fillRect(lane * pxm, H * 0.5, 0.15 * pxm, H * 0.35);
    }
    ctx.fillStyle = "#e3b23c";
    ctx.fillRect(6.85 * pxm, 0, 0.12 * pxm, H);
    ctx.fillRect(7.1 * pxm, 0, 0.12 * pxm, H);
    return tex(c);
  });

/** polished terrazzo, 9.6 m tile of 1.2 m stones */
export const floorTexture = () =>
  cached("floor", () => {
    const S = 1024;
    const { c, ctx } = make(S, S);
    const r = mulberry32(51);
    const n = 8;
    const t = S / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const l = 184 + r() * 12;
        ctx.fillStyle = `rgb(${l},${l - 4},${l - 11})`;
        ctx.fillRect(i * t, j * t, t, t);
      }
    // speckle
    for (let i = 0; i < 26000; i++) {
      const v = r();
      ctx.fillStyle = v > 0.6 ? "rgba(120,110,100,0.5)" : v > 0.3 ? "rgba(255,255,250,0.6)" : "rgba(80,76,72,0.4)";
      const s = 0.8 + r() * 2.2;
      ctx.fillRect(r() * S, r() * S, s, s);
    }
    // dark inlay bands every other stone row
    ctx.fillStyle = "rgba(52,50,50,0.95)";
    for (let i = 0; i <= n; i += 4) ctx.fillRect(i * t - 6, 0, 12, S);
    ctx.strokeStyle = "rgba(150,145,140,0.7)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * t, 0);
      ctx.lineTo(i * t, S);
      ctx.moveTo(0, i * t);
      ctx.lineTo(S, i * t);
      ctx.stroke();
    }
    return tex(c);
  });

/**
 * Desgaste do piso do saguão: um mapa de rugosidade só, esticado uma vez sobre
 * todo o piso. As faixas por onde todo mundo passa ficam mais polidas, o resto
 * guarda marca de sapato e poeira, o que quebra o brilho de espelho uniforme.
 */
export const floorWearTexture = () =>
  cached("floorWear", () => {
    const W = 512, H = 512;
    const { c, ctx } = make(W, H);
    const r = mulberry32(77);
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(0, 0, W, H);
    // faixas polidas no sentido da caminhada (v = eixo do terminal)
    for (const [u, largura, forca] of [
      [0.5, 0.17, 0.75],
      [0.24, 0.09, 0.4],
      [0.78, 0.1, 0.45],
    ] as [number, number, number][]) {
      const g = ctx.createLinearGradient((u - largura) * W, 0, (u + largura) * W, 0);
      g.addColorStop(0, "rgba(70,70,70,0)");
      g.addColorStop(0.5, `rgba(70,70,70,${forca})`);
      g.addColorStop(1, "rgba(70,70,70,0)");
      ctx.fillStyle = g;
      ctx.fillRect((u - largura) * W, 0, largura * 2 * W, H);
    }
    // poeira encostada nas paredes e nos cantos
    const borda = ctx.createLinearGradient(0, 0, 0, H);
    borda.addColorStop(0, "rgba(210,210,210,0.55)");
    borda.addColorStop(0.35, "rgba(210,210,210,0)");
    borda.addColorStop(0.75, "rgba(210,210,210,0)");
    borda.addColorStop(1, "rgba(210,210,210,0.5)");
    ctx.fillStyle = borda;
    ctx.fillRect(0, 0, W, H);
    // manchas largas de limpeza e de sapato
    for (let i = 0; i < 90; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 14 + r() * 70;
      const claro = r() > 0.45;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const a = 0.05 + r() * 0.16;
      g.addColorStop(0, claro ? `rgba(200,200,200,${a})` : `rgba(60,60,60,${a})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    noise(ctx, W, H, 10, 78);
    return tex(c, { srgb: false, clamp: true });
  });

/** carpet for the cabin */
export const carpetTexture = () =>
  cached("carpet", () => {
    const S = 256;
    const { c, ctx } = make(S, S);
    ctx.fillStyle = "#2d3342";
    ctx.fillRect(0, 0, S, S);
    const r = mulberry32(61);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() > 0.5 ? "rgba(90,100,130,0.35)" : "rgba(10,12,20,0.35)";
      ctx.fillRect(r() * S, r() * S, 2, 2);
    }
    noise(ctx, S, S, 20, 62);
    return tex(c);
  });

/* ---------------------------------------------------------------- signage */

export function signTexture(
  lines: { text: string; sub?: string; arrow?: "left" | "right" | "up" }[],
  opts: { w?: number; h?: number; bg?: string; fg?: string; accent?: string } = {},
) {
  const W = opts.w ?? 1024;
  const H = opts.h ?? 256;
  const { c, ctx } = make(W, H);
  ctx.fillStyle = opts.bg ?? "#141517";
  ctx.fillRect(0, 0, W, H);
  const rowH = H / lines.length;
  lines.forEach((l, i) => {
    const cy = rowH * i + rowH / 2;
    ctx.fillStyle = opts.fg ?? "#f5c542";
    let x = 40;
    if (l.arrow) {
      ctx.save();
      ctx.translate(x + rowH * 0.28, cy);
      ctx.rotate(l.arrow === "left" ? Math.PI : l.arrow === "up" ? -Math.PI / 2 : 0);
      ctx.beginPath();
      const a = rowH * 0.22;
      ctx.moveTo(-a, -a * 0.18);
      ctx.lineTo(a * 0.2, -a * 0.18);
      ctx.lineTo(a * 0.2, -a * 0.6);
      ctx.lineTo(a, 0);
      ctx.lineTo(a * 0.2, a * 0.6);
      ctx.lineTo(a * 0.2, a * 0.18);
      ctx.lineTo(-a, a * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      x += rowH * 0.7;
    }
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(rowH * (l.sub ? 0.34 : 0.46))}px ${FONT_SANS()}`;
    ctx.fillText(l.text, x, l.sub ? cy - rowH * 0.14 : cy);
    if (l.sub) {
      ctx.fillStyle = opts.accent ?? "rgba(255,255,255,0.72)";
      ctx.font = `400 ${Math.round(rowH * 0.22)}px ${FONT_SANS()}`;
      ctx.fillText(l.sub, x, cy + rowH * 0.22);
    }
  });
  return tex(c, { clamp: true });
}

/** Large rooftop lettering. White letters, transparent background. */
export const facadeLetteringTexture = () =>
  cached("facade-letters", () => {
    const W = 4096, H = 512;
    const { c, ctx } = make(W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 150px ${FONT_SANS()}`;
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "18px";
    ctx.fillText("AEROPORTO INTERNACIONAL", W / 2, 150);
    ctx.font = `700 230px ${FONT_SANS()}`;
    ctx.fillText("SALGADO FILHO", W / 2, 360);
    return tex(c, { clamp: true });
  });

/* ---------------------------------------------------------------- aircraft */

export const FUSELAGE = { zNose: -17.5, zTail: 20, radius: 1.98, centerY: 4.3 };

/**
 * Livery painted in the fuselage's (u around, v along) space.
 * u = 0 top, 0.25 right (+X), 0.5 belly, 0.75 left (−X). v = 0 nose → 1 tail.
 * Alpha is cut to 0 for the open L1 door so the camera can walk through it.
 */
export function liveryTexture(variant: "hero" | "blue" | "red" | "green", doorOpen: boolean) {
  return cached(`livery-${variant}-${doorOpen}`, () => {
    const W = 512, H = 2048;
    const { c, ctx } = make(W, H);
    const len = FUSELAGE.zTail - FUSELAGE.zNose;
    const circ = Math.PI * 2 * FUSELAGE.radius;
    const vOf = (z: number) => ((z - FUSELAGE.zNose) / len) * H;
    const uOf = (u: number) => u * W;
    const accent = { hero: "#ff8a3d", blue: "#1f4e9e", red: "#c3262f", green: "#1c8a5a" }[variant];
    const belly = { hero: "#23304a", blue: "#dfe3ea", red: "#e6e6e6", green: "#e4e7e5" }[variant];

    ctx.fillStyle = "#f4f5f6";
    ctx.fillRect(0, 0, W, H);
    noise(ctx, W, H, 6, 71);
    // belly
    const bg = ctx.createLinearGradient(uOf(0.36), 0, uOf(0.64), 0);
    bg.addColorStop(0, "rgba(0,0,0,0)");
    bg.addColorStop(0.12, belly);
    bg.addColorStop(0.88, belly);
    bg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(uOf(0.36), 0, uOf(0.28), H);
    // cheatlines on both sides (below windows)
    for (const side of [0.25, 0.75]) {
      const dir = side < 0.5 ? 1 : -1;
      ctx.fillStyle = accent;
      ctx.fillRect(uOf(side + dir * 0.052) - (dir < 0 ? uOf(0.012) : 0), vOf(-9), uOf(0.012), vOf(18.5) - vOf(-9));
      if (variant === "hero") {
        const grad = ctx.createLinearGradient(0, vOf(-6), 0, vOf(19));
        grad.addColorStop(0, "rgba(255,138,61,0)");
        grad.addColorStop(0.5, "rgba(255,110,64,0.9)");
        grad.addColorStop(1, "rgba(120,60,140,0.95)");
        ctx.fillStyle = grad;
        ctx.fillRect(uOf(side + dir * 0.075) - (dir < 0 ? uOf(0.05) : 0), vOf(-6), uOf(0.05), vOf(19) - vOf(-6));
      }
    }
    // windows
    const winV = (0.33 / len) * H;
    const winU = (0.44 / circ) * W;
    ctx.fillStyle = "#1a1f28";
    for (let z = -10.8; z < 15.2; z += 0.533) {
      if (z > -1.2 && z < -0.2) continue; // overwing exits spacing
      for (const side of [0.242, 0.758]) {
        const x = uOf(side) - winU / 2;
        const y = vOf(z) - winV / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, winU, winV, winV * 0.45);
        ctx.fill();
      }
    }
    // cockpit windows
    ctx.fillStyle = "#12161d";
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const u = 0.5 + s * (0.33 - i * 0.07) - 0.5 + (s > 0 ? 0 : 1);
        ctx.fillRect(uOf(u % 1) - W * 0.018, vOf(-15.4 + i * 0.25), W * 0.036, (0.5 / len) * H);
      }
    }
    // door outlines
    ctx.strokeStyle = "rgba(90,95,105,0.9)";
    ctx.lineWidth = 3;
    const doorU = (1.85 / circ) * W;
    const doorV = (0.81 / len) * H;
    for (const z of [-12.5, 14.6]) {
      for (const side of [0.25, 0.75]) {
        ctx.beginPath();
        ctx.roundRect(uOf(side) - doorU / 2, vOf(z) - doorV / 2, doorU, doorV, 10);
        ctx.stroke();
      }
    }
    // title along the left and right sides (rotated so it reads nose → tail)
    const title = variant === "hero" ? "PORTO ALEGRE" : variant === "blue" ? "AEROSUL" : variant === "red" ? "PAMPA AIR" : "GUAÍBA";
    ctx.fillStyle = variant === "hero" ? "#23304a" : accent;
    ctx.font = `700 ${Math.round((0.95 / circ) * W)}px ${FONT_SANS()}`;
    ctx.textBaseline = "middle";
    for (const [side, rot] of [
      [0.2, -Math.PI / 2],
      [0.8, Math.PI / 2],
    ] as const) {
      ctx.save();
      ctx.translate(uOf(side), vOf(1.5));
      ctx.rotate(rot);
      ctx.scale(1, W / H / (circ / len));
      ctx.textAlign = "center";
      ctx.fillText(title, 0, 0);
      ctx.restore();
    }
    // desgaste de uso: linhas de painel, fuligem dos motores, sujeira na barriga
    const rr = mulberry32(88);
    ctx.strokeStyle = "rgba(120,126,136,0.28)";
    ctx.lineWidth = 1;
    for (let z = FUSELAGE.zNose + 2; z < FUSELAGE.zTail; z += 1.9) {
      ctx.beginPath();
      ctx.moveTo(0, vOf(z));
      ctx.lineTo(W, vOf(z));
      ctx.stroke();
    }
    for (let u = 0.02; u < 1; u += 0.085) {
      ctx.beginPath();
      ctx.moveTo(uOf(u), vOf(-14));
      ctx.lineTo(uOf(u), vOf(17));
      ctx.stroke();
    }
    // fuligem saindo dos motores para trás
    for (const side of [0.3, 0.7]) {
      const g2 = ctx.createLinearGradient(0, vOf(-3), 0, vOf(12));
      g2.addColorStop(0, "rgba(40,40,44,0.32)");
      g2.addColorStop(1, "rgba(40,40,44,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(uOf(side) - uOf(0.05), vOf(-3), uOf(0.1), vOf(12) - vOf(-3));
    }
    // escorridos abaixo das portas e das janelas
    ctx.fillStyle = "rgba(70,72,78,0.18)";
    for (let i = 0; i < 40; i++) {
      const u = 0.18 + rr() * 0.64;
      const z = -12 + rr() * 26;
      ctx.fillRect(uOf(u), vOf(z), 1.5 + rr() * 2, vOf(z + 0.6 + rr() * 1.6) - vOf(z));
    }
    // barriga encardida
    const belly2 = ctx.createLinearGradient(uOf(0.38), 0, uOf(0.62), 0);
    belly2.addColorStop(0, "rgba(60,62,68,0)");
    belly2.addColorStop(0.5, "rgba(60,62,68,0.22)");
    belly2.addColorStop(1, "rgba(60,62,68,0)");
    ctx.fillStyle = belly2;
    ctx.fillRect(uOf(0.38), vOf(-10), uOf(0.24), vOf(16) - vOf(-10));

    if (doorOpen) {
      ctx.clearRect(uOf(0.75) - doorU / 2 + 2, vOf(-12.5) - doorV / 2 + 2, doorU - 4, doorV - 4);
    }
    return tex(c, { clamp: true });
  });
}

/** Emissive mask: cabin windows only (lit from inside at dusk). */
export const windowGlowTexture = () =>
  cached("window-glow", () => {
    const W = 512, H = 2048;
    const { c, ctx } = make(W, H);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const len = FUSELAGE.zTail - FUSELAGE.zNose;
    const circ = Math.PI * 2 * FUSELAGE.radius;
    const winV = (0.33 / len) * H;
    const winU = (0.44 / circ) * W;
    const r = mulberry32(5);
    for (let z = -10.8; z < 15.2; z += 0.533) {
      if (z > -1.2 && z < -0.2) continue;
      for (const side of [0.242, 0.758]) {
        const l = r() > 0.25 ? 200 + r() * 55 : 40;
        ctx.fillStyle = `rgb(${l},${l},${l})`;
        ctx.beginPath();
        ctx.roundRect(side * W - winU / 2, ((z - FUSELAGE.zNose) / len) * H - winV / 2, winU, winV, winV * 0.45);
        ctx.fill();
      }
    }
    return tex(c, { clamp: true });
  });

export const tailTexture = (variant: "hero" | "blue" | "red" | "green") =>
  cached("tail-" + variant, () => {
    const W = 512, H = 512;
    const { c, ctx } = make(W, H);
    if (variant === "hero") {
      const g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, "#23304a");
      g.addColorStop(0.45, "#7b3f7a");
      g.addColorStop(0.75, "#ff6a3d");
      g.addColorStop(1, "#ffb347");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,236,190,0.95)";
      ctx.beginPath();
      ctx.arc(W * 0.56, H * 0.52, W * 0.13, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 4; i++) ctx.fillRect(W * (0.3 + i * 0.04), H * (0.58 + i * 0.05), W * (0.52 - i * 0.07), H * 0.012);
      ctx.fillStyle = "#fff";
      ctx.font = `700 64px ${FONT_SANS()}`;
      ctx.textAlign = "center";
      ctx.fillText("POA", W * 0.56, H * 0.84);
    } else {
      const col = { blue: "#1f4e9e", red: "#c3262f", green: "#1c8a5a" }[variant];
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.moveTo(W * 0.2, H * 0.9);
      ctx.lineTo(W * 0.9, H * 0.25);
      ctx.lineTo(W * 0.9, H * 0.4);
      ctx.lineTo(W * 0.35, H * 0.9);
      ctx.fill();
    }
    return tex(c, { clamp: true });
  });

/**
 * Cabin sidewall: one window pitch (0.533 m) wide, 1.5 m tall.
 * Transparent where the window is.
 */
export const cabinWallTexture = () =>
  cached("cabin-wall", () => {
    const W = 128, H = 360;
    const { c, ctx } = make(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#e9e8e4");
    g.addColorStop(1, "#cfcdc8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    noise(ctx, W, H, 5, 81);
    const ww = W * 0.64;
    const wh = H * 0.3;
    const x = (W - ww) / 2;
    const y = H * 0.36;
    // reveal
    ctx.fillStyle = "#b9b7b2";
    ctx.beginPath();
    ctx.roundRect(x - 9, y - 12, ww + 18, wh + 24, 30);
    ctx.fill();
    ctx.fillStyle = "#d7d5d0";
    ctx.beginPath();
    ctx.roundRect(x - 5, y - 7, ww + 10, wh + 14, 26);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.roundRect(x, y, ww, wh, 22);
    ctx.fill();
    ctx.restore();
    return tex(c);
  });

/* ---------------------------------------------------------------- clouds */

export function cloudSpriteDataURL() {
  const S = 256;
  const { c, ctx } = make(S, S);
  const r = mulberry32(91);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 1.6) * S * 0.28;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d * 0.8;
    const rad = S * (0.08 + r() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return c.toDataURL("image/png");
}

/* ---------------------------------------------------------------- FIDS */

type Row = { time: string; flight: string; dest: string; gate: string; status: string; flip: number };

const STATUSES = ["No horário · On time", "Embarque · Boarding", "Última chamada · Final call", "Confirmado · Confirmed", "Atrasado · Delayed", "Portão aberto · Gate open"];

/** Split-flap style departures board that redraws only the characters in motion. */
export class DeparturesBoard {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private rows: Row[] = [];
  private rand = mulberry32(2026);
  private clock = 0;
  private nextChange = 2;
  private flights: readonly (readonly [string, string])[];

  constructor(flights: readonly (readonly [string, string])[]) {
    this.flights = flights;
    const { c, ctx } = make(2048, 768);
    this.canvas = c;
    this.ctx = ctx;
    this.texture = tex(c, { clamp: true });
    let h = 14,
      m = 5;
    for (let i = 0; i < 9; i++) {
      const f = flights[i % flights.length];
      m += 10 + Math.floor(this.rand() * 20);
      if (m >= 60) {
        h++;
        m -= 60;
      }
      this.rows.push({
        time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        flight: `${f[0]} ${1000 + Math.floor(this.rand() * 8999)}`,
        dest: f[1],
        gate: String(1 + Math.floor(this.rand() * 16)).padStart(2, "0"),
        status: STATUSES[i < 2 ? 1 : Math.floor(this.rand() * STATUSES.length)],
        flip: 0,
      });
    }
    this.draw();
  }

  update(dt: number) {
    this.clock += dt;
    let dirty = false;
    if (this.clock > this.nextChange) {
      this.nextChange = this.clock + 1.6 + this.rand() * 2.2;
      const i = Math.floor(this.rand() * this.rows.length);
      const r = this.rows[i];
      r.status = STATUSES[Math.floor(this.rand() * STATUSES.length)];
      if (this.rand() > 0.6) {
        const f = this.flights[Math.floor(this.rand() * this.flights.length)];
        r.dest = f[1];
        r.flight = `${f[0]} ${1000 + Math.floor(this.rand() * 8999)}`;
      }
      r.flip = 0.9;
      dirty = true;
    }
    for (const r of this.rows) {
      if (r.flip > 0) {
        r.flip = Math.max(0, r.flip - dt);
        dirty = true;
      }
    }
    if (dirty) this.draw();
  }

  private scramble(s: string, amount: number) {
    if (amount <= 0) return s;
    const glyphs = "ABCDEFGHIJKLMNOPRSTUVZ0123456789";
    return s
      .split("")
      .map((ch, i) => (ch !== " " && this.rand() < amount * (1 - i / (s.length + 4)) ? glyphs[Math.floor(this.rand() * glyphs.length)] : ch))
      .join("");
  }

  private draw() {
    const { ctx } = this;
    const W = 2048,
      H = 768;
    ctx.fillStyle = "#07090c";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0f1319";
    ctx.fillRect(0, 0, W, 108);
    ctx.fillStyle = "#f5c542";
    ctx.font = `600 58px ${FONT_SANS()}`;
    ctx.textBaseline = "middle";
    ctx.fillText("PARTIDAS", 40, 56);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `400 40px ${FONT_SANS()}`;
    ctx.fillText("DEPARTURES", 340, 58);
    const cols = [40, 250, 520, 1300, 1480];
    const head = ["HORA", "VOO", "DESTINO · DESTINATION", "PORTÃO", "SITUAÇÃO · STATUS"];
    ctx.font = `500 26px ${FONT_SANS()}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    head.forEach((h, i) => ctx.fillText(h, cols[i], 136));
    const rowH = 66;
    this.rows.forEach((r, i) => {
      const y = 190 + i * rowH;
      ctx.fillStyle = i % 2 ? "#0b0e13" : "#0d1117";
      ctx.fillRect(0, y - rowH / 2, W, rowH - 4);
      const f = r.flip;
      ctx.font = `500 40px ${FONT_MONO()}`;
      ctx.fillStyle = "#f0f0ea";
      ctx.fillText(r.time, cols[0], y);
      ctx.fillText(this.scramble(r.flight, f), cols[1], y);
      ctx.font = `500 42px ${FONT_SANS()}`;
      ctx.fillText(this.scramble(r.dest.toUpperCase(), f), cols[2], y);
      ctx.font = `500 40px ${FONT_MONO()}`;
      ctx.fillText(r.gate, cols[3], y);
      const boarding = r.status.startsWith("Embarque") || r.status.startsWith("Última");
      const delayed = r.status.startsWith("Atrasado");
      ctx.fillStyle = boarding ? "#7ee08a" : delayed ? "#ff7a5c" : "#f5c542";
      ctx.font = `500 34px ${FONT_SANS()}`;
      ctx.fillText(this.scramble(r.status, f), cols[4], y);
    });
    this.texture.needsUpdate = true;
  }
}
