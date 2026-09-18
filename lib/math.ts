export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));

export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};

export const smootherstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Rises over [a,b], holds, falls over [c,d]. */
export const window4 = (p: number, a: number, b: number, c: number, d: number) =>
  smoothstep(a, b, p) * (1 - smoothstep(c, d, p));

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Frame-rate independent exponential smoothing. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const fract = (x: number) => x - Math.floor(x);

export const hash1 = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEG = Math.PI / 180;

/** Yaw (rotation about +Y) that points an object's local -Z axis along (dx, dz). */
export const yawFromDir = (dx: number, dz: number) => Math.atan2(-dx, -dz);

export function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
