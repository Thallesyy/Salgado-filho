"use client";

import { AnimatePresence, motion, useMotionValueEvent, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { frame } from "@/lib/frame";
import { finaleMV, journey, progressMV, sceneIndexAt, SCENES } from "@/lib/journey";
import { clamp, lerp, smoothstep } from "@/lib/math";
import { soundscape } from "@/lib/soundscape";
import { scrollToProgress } from "../experience/useScrollDriver";

function SoundToggle() {
  const [muted, setMuted] = useState(soundscape.isMuted);
  useEffect(() => soundscape.onChange(setMuted), []);
  return (
    <button
      onClick={() => soundscape.toggle()}
      className="pointer-events-auto group flex items-center gap-3 rounded-full border border-white/15 bg-black/20 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/80 backdrop-blur-md transition hover:border-white/40"
      aria-pressed={!muted}
      aria-label={muted ? "Ligar o som" : "Desligar o som"}
    >
      <span className="flex h-3 items-end gap-[2px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="block w-[2px] rounded-full bg-amber"
            animate={muted ? { height: 2 } : { height: [3, 12, 5, 10, 3] }}
            transition={muted ? { duration: 0.3 } : { duration: 1.1 + i * 0.17, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </span>
      {muted ? "Som desligado" : "Som ligado"}
    </button>
  );
}

/** Aviation-instrument style readouts driven by the same state as the camera. */
function Telemetry() {
  const refs = {
    alt: useRef<HTMLSpanElement>(null),
    gs: useRef<HTMLSpanElement>(null),
    hdg: useRef<HTMLSpanElement>(null),
    time: useRef<HTMLSpanElement>(null),
    phase: useRef<HTMLSpanElement>(null),
  };
  useEffect(() => {
    const id = setInterval(() => {
      const p = journey.render;
      const f = journey.finaleRender;
      const altFt = Math.max(0, (frame.shot.position.y + 9) * 3.281);
      const inAir = frame.shot.inAircraft > 0.5;
      const kt = inAir ? frame.pose.knots : frame.camSpeed * 1.944;
      const v = frame.viewDir;
      const hdg = (Math.round(((Math.atan2(v.x, -v.z) * 180) / Math.PI + 360) % 360) || 360).toString().padStart(3, "0");
      // film time: 15:20 at the kerb → sunset ≈18:20 over the Guaíba → blue hour
      const minutes = lerp(15 * 60 + 20, 18 * 60 + 34, smoothstep(0, 1, p)) + f * 22;
      const hh = Math.floor(minutes / 60);
      const mm = Math.floor(minutes % 60);
      const phase = p < 0.12 ? "SOLO" : p < 0.45 ? "TERMINAL 1" : p < 0.515 ? "EMBARQUE" : p < 0.598 ? "TAXI" : p < 0.662 ? "DECOLAGEM PISTA 29" : p < 0.85 ? "SUBIDA" : f > 0 ? "SOBRE SBPA" : "SOBRE POA";
      if (refs.alt.current) refs.alt.current.textContent = Math.round(altFt).toString().padStart(5, "0");
      if (refs.gs.current) refs.gs.current.textContent = Math.round(clamp(kt, 0, 999)).toString().padStart(3, "0");
      if (refs.hdg.current) refs.hdg.current.textContent = hdg;
      if (refs.time.current) refs.time.current.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      if (refs.phase.current) refs.phase.current.textContent = phase;
    }, 90);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cell = "flex flex-col gap-1";
  const label = "text-[9px] tracking-[0.28em] text-dim";
  const value = "text-[13px] tracking-[0.12em] text-paper tabular-nums";
  return (
    <div className="pointer-events-none flex items-end gap-4 font-mono md:gap-7">
      <div className={cell}>
        <span className={label}>ALT PÉS</span>
        <span ref={refs.alt} className={value}>
          00030
        </span>
      </div>
      <div className={cell}>
        <span className={label}>VEL NÓS</span>
        <span ref={refs.gs} className={value}>
          000
        </span>
      </div>
      <div className={`${cell} hidden sm:flex`}>
        <span className={label}>PROA</span>
        <span ref={refs.hdg} className={value}>
          360
        </span>
      </div>
      <div className={`${cell} hidden sm:flex`}>
        <span className={label}>HORA</span>
        <span ref={refs.time} className={value}>
          15:20
        </span>
      </div>
      <div className={cell}>
        <span className={label}>FASE</span>
        <span ref={refs.phase} className={`${value} text-amber`}>
          SOLO
        </span>
      </div>
    </div>
  );
}

function ChapterRail() {
  const [active, setActive] = useState(0);
  useMotionValueEvent(progressMV, "change", (p) => {
    const i = sceneIndexAt(p);
    if (i !== active) setActive(i);
  });
  const fill = useTransform(progressMV, (p) => p);
  return (
    <nav aria-label="Capítulos" className="pointer-events-auto fixed left-5 top-1/2 z-30 hidden -translate-y-1/2 md:block">
      <div className="relative flex flex-col gap-5 pl-4">
        <div className="absolute left-0 top-0 h-full w-px bg-white/15" />
        <motion.div className="absolute left-0 top-0 h-full w-px origin-top bg-amber" style={{ scaleY: fill }} />
        {SCENES.map((s, i) => (
          <button key={s.id} onClick={() => scrollToProgress(s.start + 0.004)} className="group flex items-center gap-3 text-left" aria-current={i === active ? "step" : undefined}>
            <span className={`font-mono text-[10px] tracking-[0.2em] transition-colors ${i === active ? "text-amber" : "text-dim group-hover:text-paper"}`}>{s.n}</span>
            <span className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] transition-all duration-500 ${i === active ? "translate-x-0 text-paper opacity-100" : "-translate-x-2 text-dim opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`}>
              {s.title}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function ChapterTitle() {
  const [i, setI] = useState(0);
  useMotionValueEvent(progressMV, "change", (p) => {
    const n = sceneIndexAt(p);
    if (n !== i) setI(n);
  });
  const s = SCENES[i];
  return (
    <div className="relative h-4 overflow-hidden font-mono text-[10px] uppercase tracking-[0.26em] text-paper/80">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={s.id} className="block whitespace-nowrap" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          {s.n} · {s.title}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function HUD({ visible }: { visible: boolean }) {
  const hint = useTransform(progressMV, (p) => 1 - smoothstep(0.004, 0.02, p));
  const hudFade = useTransform(finaleMV, (f) => 1 - smoothstep(0.02, 0.08, f));
  const pct = useRef<HTMLSpanElement>(null);
  useMotionValueEvent(progressMV, "change", (p) => {
    if (pct.current) pct.current.textContent = String(Math.round(p * 100)).padStart(2, "0");
  });
  if (!visible) return null;
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, delay: 0.6 }}>
      <motion.div style={{ opacity: hudFade }} className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl text-paper">Salgado Filho</span>
          <span className="hidden font-mono text-[10px] tracking-[0.24em] text-dim sm:inline">POA · SBPA</span>
        </div>
        <div className="hidden md:block">
          <ChapterTitle />
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[10px] tracking-[0.2em] text-dim sm:inline">
            <span ref={pct}>00</span>%
          </span>
          <SoundToggle />
        </div>
      </motion.div>
      <motion.div style={{ opacity: hudFade }}>
        <ChapterRail />
      </motion.div>
      <motion.div style={{ opacity: hudFade }} className="absolute bottom-6 left-5 md:bottom-8 md:left-16">
        <Telemetry />
      </motion.div>
      <motion.div style={{ opacity: hint }} className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper/80">Role para viajar</span>
        <span className="relative block h-12 w-px overflow-hidden bg-white/15">
          <motion.span className="absolute left-0 top-0 block h-5 w-px bg-amber" animate={{ y: [-20, 48] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
        </span>
      </motion.div>
    </motion.div>
  );
}
