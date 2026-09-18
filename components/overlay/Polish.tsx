"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Barra fina no topo com o progresso de toda a página. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  return <motion.div aria-hidden style={{ scaleX: x }} className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-[2px] origin-left bg-amber/80" />;
}

/**
 * Cursor próprio: um ponto que acompanha o mouse e um anel que fica para trás,
 * cresce sobre botões e links e vira um rótulo de "arraste" na galeria.
 * Só aparece em telas com mouse e desligado para quem pediu menos animação.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || still) return;
    setEnabled(true);
    document.documentElement.classList.add("cursor-none");

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let scale = 1;
    let target = 1;
    let raf = 0;

    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const el = e.target as HTMLElement | null;
      const interactive = !!el?.closest("button, a, [role='tab'], input, summary");
      target = interactive ? 1.9 : 1;
    };
    const down = () => (target *= 0.8);
    const up = () => (target = target < 1.4 ? 1 : 1.9);

    const tick = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      scale += (target - scale) * 0.12;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      document.documentElement.classList.remove("cursor-none");
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  if (!enabled) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] hidden md:block">
      <div ref={ring} className="absolute left-0 top-0 h-8 w-8 rounded-full border border-paper/45 mix-blend-difference" />
      <div ref={dot} className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-amber" />
    </div>
  );
}
