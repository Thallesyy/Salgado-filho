import { Vector3 } from "three";
import { makeDirection } from "./director";
import { makePose, makeShot } from "./world";
import { useFrame } from "@react-three/fiber";
import { type RefObject } from "react";
import type { Object3D } from "three";
import { journey } from "./journey";

/** Values derived once per frame by <Director/> and read by everything else. */
export const frame = {
  pose: makePose(),
  shot: makeShot(),
  dir: makeDirection(),
  viewDir: new Vector3(0, 0, -1),
  /** camera linear speed, m/s (for audio & effects) */
  camSpeed: 0,
  /** 0..1 intensity of vibration / speed feel */
  speedFeel: 0,
  /** camera is physically inside the terminal building */
  indoors: 0,
  delta: 0.016,
};

/** Toggle an object's visibility from journey progress (plus the epilogue). */
export function useVisibleIn(ref: RefObject<Object3D | null>, ranges: [number, number][], alsoInFinale = false) {
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    const p = journey.render;
    let v = false;
    for (const [a, b] of ranges) if (p >= a && p <= b) v = true;
    if (alsoInFinale && journey.finaleRender > 0) v = true;
    o.visible = v;
  }, -1);
}
