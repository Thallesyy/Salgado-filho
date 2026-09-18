"use client";

import { animate, motion, useMotionValue, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { STAT_ANNOTATIONS, STATS_SERIES } from "@/lib/content";

type Metric = "passengers" | "movements" | "cargo";

const METRICS: { id: Metric; label: string; unit: string; format: (v: number) => string; axis: (v: number) => string }[] = [
  { id: "passengers", label: "Passageiros", unit: "passageiros", format: (v) => v.toLocaleString("pt-BR"), axis: (v) => (v === 0 ? "0" : `${(v / 1e6).toFixed(0)} mi`) },
  { id: "movements", label: "Pousos e decolagens", unit: "movimentos", format: (v) => v.toLocaleString("pt-BR"), axis: (v) => (v === 0 ? "0" : `${(v / 1000).toFixed(0)} mil`) },
  { id: "cargo", label: "Carga", unit: "toneladas", format: (v) => `${v.toLocaleString("pt-BR")} t`, axis: (v) => (v === 0 ? "0" : `${(v / 1000).toFixed(0)} mil t`) },
];

const W = 920;
const H = 380;
const M = { top: 46, right: 12, bottom: 34, left: 52 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;
const AMBER = "#ffb347";

const niceMax = (v: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

function Bar({ x, w, h, grow, index, dim }: { x: number; w: number; h: number; grow: MotionValue<number>; index: number; dim: boolean }) {
  const target = useMotionValue(0);
  useEffect(() => {
    const c = animate(target, h, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [h, target]);
  const height = useTransform([target, grow] as MotionValue<number>[], ([t, g]: number[]) => t * Math.min(1, Math.max(0, g * 1.6 - index * 0.07)));
  const y = useTransform(height, (v) => M.top + IH - v);
  // rounded data end (4px) anchored to the baseline
  const d = useTransform([y, height] as MotionValue<number>[], ([yy, hh]: number[]) => {
    const r = Math.min(4, hh, w / 2);
    const b = M.top + IH;
    if (hh <= 0.5) return `M${x},${b} h${w} v0 h${-w} Z`;
    return `M${x},${b} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + w - r} Q${x + w},${yy} ${x + w},${yy + r} V${b} Z`;
  });
  return <motion.path d={d} fill={AMBER} opacity={dim ? 0.35 : 1} />;
}

export default function StatsChart() {
  const [metric, setMetric] = useState<Metric>("passengers");
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start 95%", "center 55%"] });
  const m = METRICS.find((x) => x.id === metric)!;
  const values = STATS_SERIES[metric];
  const years = STATS_SERIES.years;

  const { max, ticks } = useMemo(() => {
    const mx = niceMax(Math.max(...values) * 1.05);
    return { max: mx, ticks: [0, 0.25, 0.5, 0.75, 1].map((k) => k * mx) };
  }, [values]);

  const band = IW / years.length;
  const bw = Math.min(46, band - 2 * 8);

  const hv = hover !== null ? values[hover] : null;
  const prev = hover !== null && hover > 0 ? values[hover - 1] : null;
  const delta = hv !== null && prev ? ((hv - prev) / prev) * 100 : null;

  return (
    <div ref={wrap} className="relative">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Indicador" className="flex flex-wrap gap-2">
          {METRICS.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={metric === x.id}
              onClick={() => setMetric(x.id)}
              className={`rounded-full border px-4 py-2 text-[13px] transition ${metric === x.id ? "border-amber bg-amber text-ink" : "border-white/15 text-paper/80 hover:border-white/40"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <button onClick={() => setTable((t) => !t)} className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim underline-offset-4 hover:text-paper hover:underline">
          {table ? "Ver gráfico" : "Ver como tabela"}
        </button>
      </div>

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[14px]">
            <caption className="sr-only">Movimento do Salgado Filho por ano, de 2017 a 2025</caption>
            <thead className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
              <tr>
                <th className="py-2 pr-4 font-normal">Ano</th>
                <th className="py-2 pr-4 font-normal">Passageiros</th>
                <th className="py-2 pr-4 font-normal">Pousos e decolagens</th>
                <th className="py-2 font-normal">Carga (t)</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y, i) => (
                <tr key={y} className="border-t border-white/10 text-paper/90">
                  <td className="py-2 pr-4 font-mono">{y}</td>
                  <td className="py-2 pr-4 tabular-nums">{STATS_SERIES.passengers[i].toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4 tabular-nums">{STATS_SERIES.movements[i].toLocaleString("pt-BR")}</td>
                  <td className="py-2 tabular-nums">{STATS_SERIES.cargo[i].toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${m.label} no Salgado Filho por ano, de 2017 a 2025. Máximo de ${m.format(Math.max(...values))}, com quedas em 2020 (pandemia) e 2024 (enchente).`}>
            {ticks.map((t) => {
              const y = M.top + IH - (t / max) * IH;
              return (
                <g key={t}>
                  <line x1={M.left} x2={W - M.right} y1={y} y2={y} stroke="rgba(243,239,231,0.1)" strokeWidth={1} />
                  <text x={M.left - 10} y={y + 4} textAnchor="end" className="fill-[rgba(243,239,231,0.55)] font-mono text-[11px]">
                    {m.axis(t)}
                  </text>
                </g>
              );
            })}
            {years.map((yr, i) => {
              const x = M.left + i * band + (band - bw) / 2;
              const h = (values[i] / max) * IH;
              const note = STAT_ANNOTATIONS[yr];
              return (
                <g key={yr}>
                  <Bar x={x} w={bw} h={h} grow={scrollYProgress} index={i} dim={hover !== null && hover !== i} />
                  <text x={x + bw / 2} y={H - 10} textAnchor="middle" className={`font-mono text-[11px] ${hover === i ? "fill-[#f3efe7]" : "fill-[rgba(243,239,231,0.55)]"}`}>
                    {yr}
                  </text>
                  {note && (
                    <g>
                      <line x1={x + bw / 2} x2={x + bw / 2} y1={M.top - 10} y2={M.top + IH - h - 8} stroke="rgba(243,239,231,0.35)" strokeDasharray="2 3" />
                      <text x={x + bw / 2} y={M.top - 16} textAnchor={i > years.length - 3 ? "end" : "middle"} className="fill-[rgba(243,239,231,0.75)] text-[11px]">
                        {note}
                      </text>
                    </g>
                  )}
                  {/* hit target larger than the mark */}
                  <rect
                    x={M.left + i * band}
                    y={M.top}
                    width={band}
                    height={IH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${yr}: ${m.format(values[i])}`}
                  />
                </g>
              );
            })}
            <line x1={M.left} x2={W - M.right} y1={M.top + IH} y2={M.top + IH} stroke="rgba(243,239,231,0.3)" />
          </svg>
          {hover !== null && hv !== null && (
            <div
              className="glass pointer-events-none absolute z-10 min-w-44 -translate-x-1/2 -translate-y-full rounded-xl px-4 py-3 text-[13px]"
              style={{
                left: `${((M.left + hover * band + band / 2) / W) * 100}%`,
                top: `${((M.top + IH - (hv / max) * IH - 12) / H) * 100}%`,
              }}
            >
              <div className="font-mono text-[11px] tracking-[0.16em] text-dim">{years[hover]}</div>
              <div className="mt-1 flex items-center gap-2 text-paper">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: AMBER }} />
                <span className="tabular-nums">{m.format(hv)}</span>
              </div>
              {delta !== null && (
                <div className="mt-1 text-paper/70 tabular-nums">
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1).replace(".", ",")}% ante {years[hover - 1]}
                </div>
              )}
              {STAT_ANNOTATIONS[years[hover]] && <div className="mt-1 text-paper/70">{STAT_ANNOTATIONS[years[hover]]}</div>}
            </div>
          )}
        </div>
      )}
      <p className="mt-4 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-dim md:text-[11px]">Fonte: tabela anual de estatísticas do verbete “Salgado Filho Porto Alegre International Airport”, na Wikipédia (ver referências).</p>
    </div>
  );
}
