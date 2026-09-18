"use client";

import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { CALLOUTS } from "@/lib/content";
import { journey } from "@/lib/journey";
import { window4 } from "@/lib/math";

/** screen x, y (px), opacity for each callout, written by the canvas, read by the DOM */
const screen = new Float32Array(CALLOUTS.length * 3);

/** Lives inside <Canvas>: projects each landmark into screen space every frame. */
export function CalloutProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const p = journey.render + journey.finaleRender * 0.5;
    CALLOUTS.forEach((c, i) => {
      v.set(c.pos[0], c.pos[1], c.pos[2]).project(camera);
      const onScreen = v.z < 1 && v.z > -1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.86;
      screen[i * 3] = (v.x * 0.5 + 0.5) * size.width;
      screen[i * 3 + 1] = (-v.y * 0.5 + 0.5) * size.height;
      const fade = 1 - Math.min(1, journey.finaleRender / 0.03);
      screen[i * 3 + 2] = journey.capturing || !onScreen ? 0 : window4(p, c.at[0], c.at[1], c.at[2], c.at[3]) * fade;
    });
  }, 0);
  return null;
}

/** DOM labels with a leader line, positioned from the projector's output. */
export function Callouts() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const tick = () => {
      CALLOUTS.forEach((_, i) => {
        const el = refs.current[i];
        if (!el) return;
        const o = screen[i * 3 + 2];
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < 0.01 ? "hidden" : "visible";
        if (o >= 0.01) el.style.transform = `translate3d(${screen[i * 3].toFixed(1)}px, ${screen[i * 3 + 1].toFixed(1)}px, 0)`;
      });
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-10" aria-hidden>
      {CALLOUTS.map((c, i) => (
        <div
          key={c.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ opacity: 0, visibility: "hidden" }}
        >
          <span className="absolute -left-[3px] -top-[3px] block h-[7px] w-[7px] rounded-full border border-amber bg-amber/30" />
          <span className="absolute left-0 top-0 block h-10 w-px -translate-y-10 bg-gradient-to-t from-amber/80 to-transparent" />
          <span className="absolute -top-14 left-2 whitespace-nowrap rounded-full border border-white/10 bg-black/35 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-paper backdrop-blur-md">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}
