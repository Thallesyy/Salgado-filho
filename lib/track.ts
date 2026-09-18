import { Vector3 } from "three";

/**
 * A keyframed curve over scroll progress.
 * Uses cubic Hermite interpolation with time-aware (non-uniform Catmull-Rom)
 * tangents so velocity stays continuous across keys with uneven spacing ,
 * which is what makes scroll-driven camera moves feel like a real dolly
 * rather than a sequence of tweens.
 *
 * A key flagged `hold` has zero tangent: the motion eases to rest there.
 */
export type Key = { p: number; v: number[]; hold?: boolean; m?: number[] };

export class Track {
  readonly keys: Key[];
  readonly dim: number;
  private tangents: number[][];

  constructor(keys: Key[]) {
    this.keys = [...keys].sort((a, b) => a.p - b.p);
    this.dim = this.keys[0].v.length;
    const n = this.keys.length;
    this.tangents = this.keys.map((k, i) => {
      if (k.m) return k.m;
      if (k.hold || i === 0 || i === n - 1) return new Array(this.dim).fill(0);
      const a = this.keys[i - 1];
      const b = this.keys[i + 1];
      const dp = b.p - a.p;
      return k.v.map((_, d) => (b.v[d] - a.v[d]) / dp);
    });
  }

  get start() {
    return this.keys[0].p;
  }
  get end() {
    return this.keys[this.keys.length - 1].p;
  }

  sample(p: number, out: number[] = new Array(this.dim)): number[] {
    const k = this.keys;
    const n = k.length;
    if (p <= k[0].p) {
      for (let d = 0; d < this.dim; d++) out[d] = k[0].v[d];
      return out;
    }
    if (p >= k[n - 1].p) {
      for (let d = 0; d < this.dim; d++) out[d] = k[n - 1].v[d];
      return out;
    }
    let i = 0;
    // keys are few (<40); a linear scan is faster than bisection here
    while (i < n - 2 && p > k[i + 1].p) i++;
    const a = k[i];
    const b = k[i + 1];
    const h = b.p - a.p;
    const t = (p - a.p) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const ma = this.tangents[i];
    const mb = this.tangents[i + 1];
    for (let d = 0; d < this.dim; d++) {
      out[d] = h00 * a.v[d] + h10 * h * ma[d] + h01 * b.v[d] + h11 * h * mb[d];
    }
    return out;
  }

  sampleVec3(p: number, out: Vector3) {
    const s = this.sample(p, _tmp);
    return out.set(s[0], s[1], s[2]);
  }
}

const _tmp = [0, 0, 0, 0, 0, 0];

/** Terse key builder: k(p, x, y, z) / k(p, x, y, z, true) for a hold. */
export const k3 = (p: number, x: number, y: number, z: number, hold?: boolean): Key => ({
  p,
  v: [x, y, z],
  hold,
});

export const k1 = (p: number, v: number, hold?: boolean): Key => ({ p, v: [v], hold });
