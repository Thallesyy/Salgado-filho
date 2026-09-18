/**
 * Shared geography for Porto Alegre: the same functions exist in GLSL
 * (terrain shader) and TypeScript (building placement), so buildings never
 * stand in the Guaíba.
 */

export const HILLS: [number, number, number, number][] = [
  // x, z, height, radius
  [4900, 6200, 290, 1700], // Morro Santana
  [-2600, 10800, 250, 1500], // Morro da Polícia
  [1800, 12500, 220, 1900],
  [7600, 1500, 120, 1600],
];

export const shoreX = (z: number) => {
  const south = -6650 + 180 * Math.sin(z / 850) + 120 * Math.sin(z / 310 + 1.3);
  const north = -5350 + 220 * Math.sin(z / 700 + 0.4) + 90 * Math.sin(z / 260);
  const t = Math.min(1, Math.max(0, (z - 3700) / 900));
  const s = t * t * (3 - 2 * t);
  return north + (south - north) * s;
};

export const riverZ = (x: number) => -2750 + 260 * Math.sin(x / 950) + 90 * Math.sin(x / 300);

export function isWater(x: number, z: number, margin = 60) {
  if (z > -3900 && x > -16000 && x < shoreX(z) + margin) return true;
  if (x < -5400 + margin && z < 3500 && z > -4200) return true; // delta
  if (x > -5600 && x < 9500 && Math.abs(z - riverZ(x)) < 110 + margin) return true;
  return false;
}

export const inAirport = (x: number, z: number, margin = 0) =>
  (x > -3000 - margin && x < 1100 + margin && z > -700 - margin && z < -130 + margin) ||
  (x > -480 - margin && x < 480 + margin && z > -260 - margin && z < 300 + margin);

export function hillHeight(x: number, z: number) {
  let h = 0;
  for (const [hx, hz, hh, r] of HILLS) {
    const d2 = ((x - hx) ** 2 + (z - hz) ** 2) / (r * r);
    h += hh * Math.exp(-d2 * 2.2);
  }
  return h;
}

export const GLSL_GEO = /* glsl */ `
float geoH21(vec2 p){ p = fract(p*vec2(233.34, 851.73)); p += dot(p, p+23.45); return fract(p.x*p.y); }
float geoNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(geoH21(i), geoH21(i+vec2(1,0)), u.x), mix(geoH21(i+vec2(0,1)), geoH21(i+vec2(1,1)), u.x), u.y);
}
float geoFbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*geoNoise(p); p=p*2.07+11.3; a*=0.5; } return v; }
float geoShoreX(float z){
  float south = -6650.0 + 180.0*sin(z/850.0) + 120.0*sin(z/310.0+1.3);
  float north = -5350.0 + 220.0*sin(z/700.0+0.4) + 90.0*sin(z/260.0);
  return mix(north, south, smoothstep(3700.0, 4600.0, z));
}
float geoWater(vec2 w){
  float s = geoShoreX(w.y) + (geoNoise(w/120.0)-0.5)*50.0;
  float water = (1.0 - smoothstep(s-25.0, s+25.0, w.x)) * smoothstep(-16300.0, -16000.0, w.x) * smoothstep(-4200.0, -3900.0, w.y);
  float delta = (1.0 - smoothstep(-5500.0, -5300.0, w.x)) * (1.0 - smoothstep(3300.0, 3600.0, w.y)) * smoothstep(-4400.0, -4100.0, w.y);
  float islands = smoothstep(0.5, 0.53, geoFbm(w/1300.0 + 7.3));
  water = max(water * (1.0 - islands * step(w.y, 3400.0) * (1.0 - smoothstep(-5600.0,-5200.0,w.x))), delta * (1.0 - islands));
  float rz = -2750.0 + 260.0*sin(w.x/950.0) + 90.0*sin(w.x/300.0);
  float river = (1.0 - smoothstep(70.0, 115.0, abs(w.y - rz))) * smoothstep(-5700.0,-5400.0,w.x) * (1.0 - smoothstep(9200.0, 9600.0, w.x));
  return max(water, river);
}
float geoBox(vec2 w, vec2 mn, vec2 mx, float soft){
  vec2 a = smoothstep(mn - soft, mn + soft, w) * (1.0 - smoothstep(mx - soft, mx + soft, w));
  return a.x * a.y;
}
float geoAirport(vec2 w){
  return max(geoBox(w, vec2(-3000.0, -700.0), vec2(1100.0, -130.0), 20.0), geoBox(w, vec2(-480.0, -260.0), vec2(480.0, 300.0), 10.0));
}
float geoHill(vec2 w){
  float h = 0.0;
  ${HILLS.map(([x, z, hh, r]) => `h += ${hh.toFixed(1)} * exp(-dot(w - vec2(${x.toFixed(1)}, ${z.toFixed(1)}), w - vec2(${x.toFixed(1)}, ${z.toFixed(1)})) / ${(r * r).toFixed(1)} * 2.2);`).join("\n  ")}
  return h;
}
`;
