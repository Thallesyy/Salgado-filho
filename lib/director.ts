import { Color, Vector3 } from "three";
import { clamp, DEG, lerp, smoothstep, window4 } from "./math";
import { Track } from "./track";

/**
 * The "director of photography": every lighting / grading parameter
 * as a function of journey progress (+ epilogue progress).
 */

const k = (p: number, ...v: number[]) => ({ p, v });

// sun elevation°, azimuth° (0 = north, 90 = east, 270 = west)
const sunTrack = new Track([
  k(0.0, 36, 238),
  k(0.12, 34, 242),
  k(0.38, 30, 250),
  k(0.52, 24, 258),
  k(0.62, 15, 266),
  k(0.69, 9, 270),
  k(0.78, 3.6, 274),
  k(0.85, 0.9, 276),
  k(0.93, -1.0, 277),
  k(1.0, -2.4, 278),
  k(1.4, -5.5, 279),
]);

// exposure, bloom intensity, grain, vignette, saturation, contrast
const gradeTrack = new Track([
  k(0.0, 0.78, 0.3, 0.045, 0.4, 1.1, 1.12),
  k(0.11, 0.8, 0.3, 0.045, 0.42, 1.1, 1.12),
  k(0.14, 0.76, 0.45, 0.045, 0.48, 1.06, 1.16),
  k(0.38, 0.76, 0.5, 0.045, 0.48, 1.05, 1.16),
  k(0.45, 0.92, 0.5, 0.045, 0.52, 1.05, 1.12),
  k(0.52, 0.95, 0.55, 0.05, 0.58, 1.05, 1.12),
  k(0.62, 0.9, 0.6, 0.05, 0.6, 1.08, 1.14),
  k(0.75, 0.95, 0.7, 0.05, 0.56, 1.12, 1.14),
  k(0.85, 1.1, 0.9, 0.05, 0.52, 1.15, 1.12),
  k(0.93, 1.35, 1.0, 0.05, 0.5, 1.12, 1.1),
  k(1.0, 1.55, 1.1, 0.05, 0.5, 1.1, 1.1),
  k(1.4, 2.0, 1.25, 0.06, 0.55, 1.05, 1.08),
]);

export type Direction = {
  sunDir: Vector3;
  sunElevation: number;
  sunColor: Color;
  sunIntensity: number;
  skyColor: Color;
  groundColor: Color;
  hemiIntensity: number;
  fogColor: Color;
  fogDensity: number;
  envIntensity: number;
  night: number;
  exposure: number;
  bloom: number;
  grain: number;
  vignette: number;
  saturation: number;
  contrast: number;
  /** interior practical lights (terminal) */
  interior: number;
  /** cabin mood lighting 0 white … 1 dimmed blue */
  cabinMood: number;
  /** cinematic letterbox 0..1 */
  letterbox: number;
  bokeh: number;
  shadows: boolean;
};

export const makeDirection = (): Direction => ({
  sunDir: new Vector3(),
  sunElevation: 30,
  sunColor: new Color(),
  sunIntensity: 3,
  skyColor: new Color(),
  groundColor: new Color(),
  hemiIntensity: 1,
  fogColor: new Color(),
  fogDensity: 0.0001,
  envIntensity: 1,
  night: 0,
  exposure: 1,
  bloom: 0.5,
  grain: 0.05,
  vignette: 0.4,
  saturation: 1,
  contrast: 1,
  interior: 0,
  cabinMood: 0,
  letterbox: 0,
  bokeh: 2,
  shadows: true,
});

const C = (hex: string) => new Color(hex);
const SUN_DAY = C("#fff4e2");
const SUN_GOLD = C("#ffb56b");
const SUN_SET = C("#ff7a3d");
const SKY_DAY = C("#9fc4ea");
const SKY_DUSK = C("#6d6fa8");
const SKY_NIGHT = C("#1a2140");
const GROUND_DAY = C("#8a8170");
const GROUND_DUSK = C("#5a4a52");
const FOG_DAY = C("#c9d6e2");
const FOG_GOLD = C("#e9b48a");
const FOG_DUSK = C("#8c6f86");
const FOG_NIGHT = C("#2a2d48");
const FOG_SUNWARD = C("#ffb070");

const tmp = new Color();
const g: number[] = new Array(6);
const s: number[] = new Array(2);

export function direct(p: number, finale: number, viewDir: Vector3, out: Direction) {
  const P = p + finale * 0.4;
  sunTrack.sample(P, s);
  const el = s[0];
  const az = s[1] * DEG;
  const elr = el * DEG;
  out.sunElevation = el;
  out.sunDir.set(Math.sin(az) * Math.cos(elr), Math.sin(elr), -Math.cos(az) * Math.cos(elr)).normalize();

  const gold = smoothstep(22, 4, el);
  const set = smoothstep(5, -1, el);
  const night = smoothstep(3, -5, el);
  out.night = night;

  out.sunColor.copy(SUN_DAY).lerp(SUN_GOLD, gold).lerp(SUN_SET, set);
  out.sunIntensity = lerp(3.4, 2.2, gold) * (1 - smoothstep(1.5, -2.5, el));

  out.skyColor.copy(SKY_DAY).lerp(SKY_DUSK, set).lerp(SKY_NIGHT, night);
  out.groundColor.copy(GROUND_DAY).lerp(GROUND_DUSK, set);
  out.hemiIntensity = lerp(0.9, 0.35, night);

  // fog: cooler away from the sun, warm when looking into the sunset
  out.fogColor.copy(FOG_DAY).lerp(FOG_GOLD, gold).lerp(FOG_DUSK, set).lerp(FOG_NIGHT, night);
  const toward = Math.pow(clamp(viewDir.dot(out.sunDir) * 0.5 + 0.5), 3);
  tmp.copy(FOG_SUNWARD).multiplyScalar(lerp(0.4, 1.0, gold) * (1 - night * 0.7));
  out.fogColor.lerp(tmp, toward * gold * 0.55);

  const interiorBoost = window4(p, 0.118, 0.14, 0.46, 0.5);
  out.fogDensity = lerp(0.00011, 0.000035, interiorBoost) + 0.00003 * gold;
  out.envIntensity = lerp(1.0, 0.45, night);

  gradeTrack.sample(P, g);
  out.exposure = g[0];
  out.bloom = g[1];
  out.grain = g[2];
  out.vignette = g[3];
  out.saturation = g[4];
  out.contrast = g[5];

  out.interior = interiorBoost;
  out.cabinMood = smoothstep(0.585, 0.62, p) * (1 - smoothstep(0.84, 0.86, p)) + 0.35 * smoothstep(0.72, 0.8, p);
  out.letterbox = window4(p, 0.6, 0.625, 0.68, 0.71);
  out.bokeh = p < 0.12 ? 1.2 : p < 0.46 ? 2.4 : p < 0.86 ? 3.2 : 1.0;
  out.shadows = P < 0.72 || P > 0.88;
  return out;
}
