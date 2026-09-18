"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { GALLERY_SHOTS, REFERENCES } from "@/lib/content";
import { useGalleryImages } from "@/lib/gallery";
import { ILUSTRACOES, PHOTOS, photoList, src, srcIlustracao } from "@/lib/photos";
import StatsChart from "./StatsChart";
import Timeline from "./Timeline";

const reveal = {
  initial: { opacity: 0, y: 40, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: false, amount: 0.35 },
  transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] as const },
};

function Intro() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const letter = useTransform(scrollYProgress, [0.1, 0.5], ["0.18em", "-0.02em"]);
  return (
    <div ref={ref} className="relative flex min-h-[100svh] items-center px-5 md:min-h-[110vh] md:px-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_50%,rgba(7,8,10,0.85),rgba(7,8,10,0))]" />
      <motion.div style={{ y }} className="relative max-w-5xl">
        <motion.p {...reveal} className="mb-5 font-mono text-[10px] uppercase tracking-[0.3em] text-amber md:mb-6 md:text-[11px]">
          Epílogo
        </motion.p>
        <motion.h2 style={{ letterSpacing: letter }} className="text-balance font-display text-[13vw] leading-[0.9] text-paper md:text-[7.5vw]">
          Um século de conexões, <em className="text-amber">uma pista</em> por vez.
        </motion.h2>
        <motion.p {...reveal} className="mt-7 max-w-xl text-[17px] leading-relaxed text-paper/75 md:mt-8 md:text-lg">
          De um campo de pouso em São João a uma pista de 3.200 metros refeita depois da enchente de 2024, o Salgado Filho cresceu junto com Porto Alegre e levou o Rio Grande do Sul ao mundo.
        </motion.p>
      </motion.div>
    </div>
  );
}

const KPIS = [
  { v: "3.200 m", l: "Pista 11/29" },
  { v: "16", l: "Portões com ponte de embarque" },
  { v: "37.600 m²", l: "Terminal 1" },
  { v: "R$ 1,8 bi", l: "Programa de investimentos da Fraport" },
  { v: "9 m", l: "Altitude acima do nível do mar" },
];

function Numbers() {
  return (
    <section className="relative px-4 py-24 md:px-16 md:py-32" aria-labelledby="numbers-title">
      <div className="glass mx-auto max-w-6xl rounded-3xl p-5 md:p-12">
        <motion.p {...reveal} className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-amber md:text-[11px]">
          Estatísticas interativas
        </motion.p>
        <motion.h2 {...reveal} id="numbers-title" className="mb-8 font-display text-4xl leading-none text-paper md:mb-10 md:text-6xl">
          O movimento, ano a ano
        </motion.h2>
        <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 md:mb-12 md:grid-cols-5">
          {KPIS.map((k, i) => (
            <motion.div key={k.l} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} className="bg-ink/60 p-4 md:p-5">
              <div className="font-display text-2xl text-paper md:text-4xl">{k.v}</div>
              <div className="mt-2 font-mono text-[9px] uppercase leading-snug tracking-[0.18em] text-dim md:text-[10px]">{k.l}</div>
            </motion.div>
          ))}
        </div>
        <StatsChart />
      </div>
    </section>
  );
}

function Enchente() {
  const fotos = [
    { k: "enchente-aeroporto", tag: "17 de maio de 2024", txt: "A pista e o pátio submersos. Os voos foram transferidos para a Base Aérea de Canoas." },
    { k: "pista", tag: "janeiro de 2025", txt: "A pista de volta em operação, depois de 1.400 metros de pavimento refeitos." },
  ];
  return (
    <section className="relative px-4 py-24 md:px-16 md:py-32" aria-labelledby="enchente-title">
      <div className="glass mx-auto max-w-6xl rounded-3xl p-5 md:p-12">
        <motion.p {...reveal} className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-amber md:text-[11px]">
          Maio de 2024
        </motion.p>
        <motion.h2 {...reveal} id="enchente-title" className="max-w-3xl text-balance font-display text-4xl leading-[0.95] text-paper md:text-6xl">
          A enchente que parou o aeroporto, e a volta por cima
        </motion.h2>
        <motion.p {...reveal} className="mt-6 max-w-2xl text-[16px] leading-relaxed text-paper/75 md:text-lg">
          O Salgado Filho fechou em 3 de maio de 2024 e ficou cinco meses e meio sem voos comerciais. O movimento caiu 48% naquele ano. A operação voltou em parte no dia 21 de outubro e por completo em 16 de dezembro. Em 2025, o aeroporto recebeu 7,51 milhões de passageiros, acima do movimento anterior à cheia.
        </motion.p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 md:gap-8">
          {fotos.map((f, i) => {
            const p = PHOTOS[f.k];
            return (
              <motion.figure key={f.k} {...reveal} transition={{ ...reveal.transition, delay: i * 0.1 }}>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(f.k)} alt={p.alt} loading="lazy" decoding="async" className="block aspect-[3/2] w-full object-cover" />
                </div>
                <figcaption className="mt-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber">{f.tag}</div>
                  <p className="mt-2 text-[15px] leading-relaxed text-paper/80">{f.txt}</p>
                  <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-dim">
                    {p.autor}, {p.licenca}
                  </p>
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type Item = { src: string; srcSmall: string; title: string; caption: string; credit?: string };

function Gallery() {
  const stills = useGalleryImages();
  const [tab, setTab] = useState<"fotos" | "filme" | "ilustra">("fotos");
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], ["3%", "-30%"]);

  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  const items: Item[] = useMemo(() => {
    if (tab === "fotos")
      return photoList.map((p) => ({
        src: src(p.key),
        srcSmall: src(p.key, true),
        title: p.legenda,
        caption: `${p.autor}, ${p.licenca}`,
        credit: p.fonte,
      }));
    if (tab === "ilustra")
      return ILUSTRACOES.map((il) => ({ src: srcIlustracao(il.key), srcSmall: srcIlustracao(il.key, true), title: il.legenda, caption: "Imagem gerada por IA" }));
    return GALLERY_SHOTS.map((s, i) => ({ src: stills[i], srcSmall: stills[i], title: s.title, caption: s.caption })).filter((i) => i.src);
  }, [tab, stills]);

  const step = (from: number, dir: 1 | -1) => (items.length ? (from + dir + items.length) % items.length : from);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open === null) return;
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : step(o, 1)));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : step(o, -1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length]);

  useEffect(() => setOpen(null), [tab]);

  return (
    <section ref={ref} className="relative overflow-hidden py-24 md:py-32" aria-labelledby="gallery-title">
      <div className="relative mb-8 px-5 py-6 md:mb-10 md:px-16 md:py-8">
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-ink via-ink/85 to-transparent" />
        <motion.p {...reveal} className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-amber md:text-[11px]">
          Galeria
        </motion.p>
        <motion.h2 {...reveal} id="gallery-title" className="font-display text-4xl leading-none text-paper md:text-6xl">
          O aeroporto por inteiro
        </motion.h2>
        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Tipo de imagem">
          {(
            [
              ["fotos", "Fotos reais"],
              ["filme", "Quadros do filme"],
              ["ilustra", "Ilustrações"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-full border px-4 py-2 text-[13px] transition ${tab === id ? "border-amber bg-amber text-ink" : "border-white/15 text-paper/80 hover:border-white/40"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 max-w-xl pb-2 text-[15px] text-paper/70">
          {tab === "fotos"
            ? "Fotografias do aeroporto e da cidade, publicadas sob licença livre. O crédito de cada autor aparece na imagem e no rodapé."
            : tab === "ilustra"
              ? "Imagens geradas por inteligência artificial, usadas como ilustração. Elas não retratam o Salgado Filho."
              : items.length
              ? "Quadros capturados do próprio filme 3D enquanto ele roda no seu computador."
              : "Os quadros do filme aparecem aqui conforme você percorre a jornada. Volte ao topo e role a página para revelá-los."}
        </p>
      </div>
      <motion.ul style={mobile ? undefined : { x }} className={`mt-2 flex gap-4 px-5 md:gap-5 md:px-16 ${mobile ? "snap-strip overflow-x-auto pb-2" : ""}`}>
        {items.map((it, i) => (
          <li key={it.title + i} className="shrink-0">
            <button onClick={() => setOpen(i)} className="group block w-[80vw] text-left sm:w-[46vw] md:w-[32vw]" aria-label={`Abrir imagem: ${it.title}`}>
              <motion.div layoutId={`img-${tab}-${i}`} className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.srcSmall} alt={it.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-amber">{String(i + 1).padStart(2, "0")}</span>
                </div>
              </motion.div>
              <div className="mt-3">
                <div className="font-display text-lg leading-snug text-paper md:text-xl">{it.title}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">{it.caption}</div>
              </div>
            </button>
          </li>
        ))}
      </motion.ul>

      <AnimatePresence>
        {open !== null && items[open] && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md md:p-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
            role="dialog"
            aria-modal="true"
            aria-label={items[open].title}
          >
            <motion.figure layoutId={`img-${tab}-${open}`} className="relative w-full max-w-6xl overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={items[open].src} alt={items[open].title} className="block max-h-[70vh] w-full object-contain" />
              <figcaption className="flex flex-wrap items-center justify-between gap-4 bg-ink/90 px-5 py-4">
                <div>
                  <div className="font-display text-xl text-paper md:text-2xl">{items[open].title}</div>
                  <div className="text-[13px] text-dim">
                    {items[open].caption}
                    {items[open].credit && (
                      <>
                        {" · "}
                        <a href={items[open].credit} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                          ver original
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-full border border-white/20 px-4 py-2 text-[14px] text-paper" onClick={() => setOpen((o) => step(o!, -1))} aria-label="Imagem anterior">
                    ←
                  </button>
                  <button className="rounded-full border border-white/20 px-4 py-2 text-[14px] text-paper" onClick={() => setOpen((o) => step(o!, 1))} aria-label="Próxima imagem">
                    →
                  </button>
                  <button className="rounded-full bg-paper px-4 py-2 text-[14px] text-ink" onClick={() => setOpen(null)}>
                    Fechar
                  </button>
                </div>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function References() {
  return (
    <section className="relative px-4 pb-16 pt-24 md:px-16 md:pt-32" aria-labelledby="refs-title">
      <div className="mx-auto max-w-6xl rounded-3xl bg-ink/85 p-5 backdrop-blur-xl md:p-12">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-12">
          <div>
            <motion.p {...reveal} className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-amber md:text-[11px]">
              Referências e fontes
            </motion.p>
            <motion.h2 {...reveal} id="refs-title" className="font-display text-4xl leading-none text-paper md:text-5xl">
              De onde vêm os dados
            </motion.h2>
            <p className="mt-6 text-[14px] leading-relaxed text-paper/65">
              Os números foram conferidos nas fontes desta lista em setembro de 2026. Rotas e horários mudam com frequência, então confirme com a companhia aérea antes de viajar.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-paper/65">
              Os ambientes em 3D são reconstruções artísticas geradas por código, não levantamentos técnicos. As pinturas das aeronaves, os nomes das lojas e o painel de voos são ilustrativos.
            </p>
          </div>
          <ol className="divide-y divide-white/10">
            {REFERENCES.map((r, i) => (
              <motion.li key={r.url} {...reveal} transition={{ ...reveal.transition, delay: i * 0.03 }} className="py-4">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="group grid grid-cols-[2.5rem_1fr] gap-2">
                  <span className="font-mono text-[11px] text-amber">[{String(i + 1).padStart(2, "0")}]</span>
                  <span>
                    <span className="block text-[15px] text-paper underline-offset-4 group-hover:underline">{r.title}</span>
                    <span className="block text-[13px] text-dim">
                      {r.publisher}. {r.used}
                    </span>
                  </span>
                </a>
              </motion.li>
            ))}
          </ol>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-amber md:text-[11px]">Créditos das fotografias</h3>
          <ul className="grid gap-x-8 gap-y-2 text-[13px] text-paper/70 md:grid-cols-2">
            {photoList.map((p) => (
              <li key={p.key}>
                {p.legenda}. {p.autor},{" "}
                <a href={p.licencaUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {p.licenca}
                </a>
                {". "}
                <a href={p.fonte} target="_blank" rel="noopener noreferrer" className="text-dim underline underline-offset-4">
                  Wikimedia Commons
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] leading-relaxed text-paper/60">
            Modelos 3D de mobiliário e objetos:{" "}
            <a href="https://polyhaven.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Poly Haven
            </a>
            . Pessoas animadas:{" "}
            <a href="https://quaternius.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Quaternius
            </a>
            . Texturas de concreto, asfalto e metal:{" "}
            <a href="https://ambientcg.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              ambientCG
            </a>
            . Todos em domínio público (CC0).
          </p>
        </div>
      </div>

      <footer className="mx-auto mt-14 flex max-w-6xl flex-col items-start justify-between gap-6 border-t border-white/10 pt-8 md:flex-row md:items-center">
        <div>
          <div className="font-display text-2xl text-paper md:text-3xl">Salgado Filho</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-dim">Documentário interativo · Porto Alegre, RS</div>
        </div>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="rounded-full border border-white/20 px-6 py-3 text-[14px] text-paper transition hover:border-amber md:text-[13px]"
        >
          Voltar para a calçada de embarque ↑
        </button>
      </footer>
    </section>
  );
}

export default function Finale() {
  return (
    <section id="finale" className="relative">
      <Intro />
      <Timeline />
      <Enchente />
      <Numbers />
      <Gallery />
      <References />
    </section>
  );
}
