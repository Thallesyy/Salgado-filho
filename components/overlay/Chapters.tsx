"use client";

import { motion, useMotionValueEvent, useTransform } from "framer-motion";
import { useRef } from "react";
import { CARDS, type Card, type Stat } from "@/lib/content";
import { ILUSTRACAO, PHOTOS, src, srcIlustracao } from "@/lib/photos";
import { finaleMV, progressMV } from "@/lib/journey";
import { smoothstep, window4 } from "@/lib/math";

const fmt = (s: Stat, v: number) => {
  const n = s.decimals ? v.toFixed(s.decimals) : Math.round(v).toLocaleString("en-US");
  return `${s.prefix ?? ""}${n}${s.suffix ?? ""}`;
};

/** A number that counts up as you scroll into its card. */
function StatNumber({ stat, card }: { stat: Stat; card: Card }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [a, b, c] = card.at;
  useMotionValueEvent(progressMV, "change", (p) => {
    if (!ref.current) return;
    const k = a < 0 ? 1 : smoothstep(a, b + (c - b) * 0.45, p);
    const eased = 1 - Math.pow(1 - k, 3);
    ref.current.textContent = fmt(stat, stat.value * eased);
  });
  return (
    <span ref={ref} className="tabular-nums">
      {fmt(stat, a < 0 ? stat.value : 0)}
    </span>
  );
}

const MOBILE = "left-3 right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[52svh] overflow-y-auto overscroll-contain";
const POS: Record<Card["layout"], string> = {
  left: `${MOBILE} md:inset-auto md:max-h-none md:overflow-visible md:left-16 md:top-1/2 md:-translate-y-1/2 md:max-w-[440px]`,
  right: `${MOBILE} md:inset-auto md:max-h-none md:overflow-visible md:right-16 md:top-1/2 md:-translate-y-1/2 md:max-w-[440px]`,
  "bottom-left": `${MOBILE} md:inset-auto md:max-h-none md:overflow-visible md:left-16 md:bottom-20 md:max-w-[640px]`,
  "bottom-right": `${MOBILE} md:inset-auto md:max-h-none md:overflow-visible md:right-16 md:bottom-20 md:max-w-[480px]`,
  center: "left-4 right-4 top-1/2 -translate-y-1/2 text-center md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(900px,80vw)]",
  chapter: "left-4 right-4 bottom-[22svh] md:right-auto md:left-16 md:bottom-[16vh] md:max-w-[80vw]",
};

function CardView({ card, index }: { card: Card; index: number }) {
  const [a, b, c, d] = card.at;
  const o = useTransform([progressMV, finaleMV], ([p, f]: number[]) => (a < 0 ? 1 - smoothstep(c, d, p) : window4(p, a, b, c, d)) * (1 - smoothstep(0.0, 0.035, f)));
  const y = useTransform(o, (v) => (1 - v) * 28);
  const filter = useTransform(o, (v) => `blur(${((1 - v) * 10).toFixed(2)}px)`);
  const visibility = useTransform(o, (v) => (v < 0.005 ? "hidden" : "visible"));
  const line = useTransform(progressMV, (p) => (a < 0 ? 1 : smoothstep(a, c, p)));

  if (card.layout === "chapter") {
    return (
      <motion.section style={{ opacity: o, y, filter, visibility }} className={`pointer-events-none fixed z-20 ${POS.chapter}`} aria-live="polite">
        <div className="mb-4 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.3em] text-amber">
          <span>{card.kicker}</span>
          <motion.span style={{ scaleX: line }} className="hairline block w-40 origin-left" />
        </div>
        <h2 className="font-display text-[13vw] leading-[0.85] tracking-[-0.02em] text-paper drop-shadow-[0_4px_40px_rgba(0,0,0,0.55)] md:text-[9vw]">{card.title}</h2>
      </motion.section>
    );
  }

  const isCenter = card.layout === "center";
  return (
    <motion.section style={{ opacity: o, y, filter, visibility }} className={`pointer-events-none fixed z-20 ${POS[card.layout]}`} data-card={index}>
      <div className={`relative ${isCenter ? "" : "glass rounded-2xl p-6 md:p-7"}`}>
        {isCenter && <div aria-hidden className="absolute -inset-x-24 -inset-y-20 -z-10 bg-[radial-gradient(closest-side,rgba(4,5,7,0.55),rgba(4,5,7,0))]" />}
        {card.kicker && (
          <p className={`mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-amber ${isCenter ? "justify-center" : ""}`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber" />
            {card.kicker}
          </p>
        )}
        {card.title && (
          <h3 className={`text-balance font-display leading-[0.95] tracking-[-0.01em] text-paper ${isCenter ? "text-[14vw] md:text-[8.5vw]" : "text-[2rem] md:text-[3.4rem]"}`}>{card.title}</h3>
        )}
        {card.stats && (
          <div className={`mt-2 grid gap-x-10 gap-y-5 ${card.stats.length > 2 ? "grid-cols-1 sm:grid-cols-3" : card.stats.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            {card.stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-[2.6rem] leading-none text-paper md:text-[4.2rem]">
                  <StatNumber stat={s} card={card} />
                </div>
                <div className="mt-2 max-w-[18ch] font-mono text-[11px] uppercase leading-snug tracking-[0.14em] text-dim">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {card.body && <p className={`mt-4 text-pretty text-[15px] leading-relaxed text-paper/80 md:text-base ${isCenter ? "mx-auto max-w-xl" : "max-w-md"}`}>{card.body}</p>}
        {card.steps && (
          <ol className="mt-5 space-y-2.5">
            {card.steps.map((s, i) => (
              <li key={s} className="flex items-baseline gap-4 text-[15px] text-paper/85">
                <span className="font-mono text-[11px] text-amber">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
        {card.chips && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {card.chips.map((c) => (
              <li key={c} className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[13px] text-paper/90 backdrop-blur-sm">
                {c}
              </li>
            ))}
          </ul>
        )}
        {card.photo && PHOTOS[card.photo] && (
          <figure className="mt-5 max-w-[300px]">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src(card.photo, true)}
                srcSet={`${src(card.photo, true)} 560w, ${src(card.photo)} 1400w`}
                sizes="300px"
                alt={PHOTOS[card.photo].alt}
                loading="lazy"
                decoding="async"
                className="block aspect-[4/3] w-full object-cover"
              />
            </div>
            <figcaption className="mt-2 font-mono text-[10px] leading-relaxed tracking-[0.12em] text-dim">
              Foto: {PHOTOS[card.photo].legenda}. {PHOTOS[card.photo].autor}, {PHOTOS[card.photo].licenca}
            </figcaption>
          </figure>
        )}
        {card.ilustracao && ILUSTRACAO[card.ilustracao] && (
          <figure className="mt-5 max-w-[320px]">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={srcIlustracao(card.ilustracao, true)}
                srcSet={`${srcIlustracao(card.ilustracao, true)} 560w, ${srcIlustracao(card.ilustracao)} 1376w`}
                sizes="320px"
                alt={ILUSTRACAO[card.ilustracao].alt}
                loading="lazy"
                decoding="async"
                className="block w-full object-cover"
              />
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-paper/90 backdrop-blur-sm">Ilustração</span>
            </div>
            <figcaption className="mt-2 font-mono text-[10px] leading-relaxed tracking-[0.12em] text-dim">
              {ILUSTRACAO[card.ilustracao].legenda}. Imagem gerada por IA
            </figcaption>
          </figure>
        )}
        {card.note && <p className="mt-5 font-mono text-[11px] tracking-[0.2em] text-dim">{card.note}</p>}
      </div>
    </motion.section>
  );
}

export default function Chapters() {
  return (
    <div aria-label="Narração do documentário">
      {CARDS.map((c, i) => (
        <CardView key={i} card={c} index={i} />
      ))}
    </div>
  );
}
