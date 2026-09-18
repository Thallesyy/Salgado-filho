"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { JOURNEY_VH, journey } from "@/lib/journey";
import { soundscape } from "@/lib/soundscape";
import { detectTier, forgetSafeMode, type Tier } from "@/lib/gpu";
import Loader from "../overlay/Loader";
import { Callouts } from "../overlay/Callouts";
import Chapters from "../overlay/Chapters";
import HUD from "../overlay/HUD";
import { Cursor, ScrollProgress } from "../overlay/Polish";
import Finale from "../final/Finale";
import { useScrollDriver } from "./useScrollDriver";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

export default function ExperienceRoot() {
  const [fontsReady, setFontsReady] = useState(false);
  const [tier, setTier] = useState<Tier | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [patience, setPatience] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [journeyVh, setJourneyVh] = useState(JOURNEY_VH);
  const [tierReason, setTierReason] = useState("");

  useScrollDriver();

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    // slow GPUs: allow starting before every gallery still has been developed
    const timer = setTimeout(() => setPatience(true), 20000);
    if (window.matchMedia("(max-width: 767px)").matches) setJourneyVh(Math.round(JOURNEY_VH * 0.7));
    const t = detectTier();
    journey.quality = t.tier;
    setTier(t.tier);
    setTierReason(t.reason);
    document.fonts.ready.then(() => setFontsReady(true));
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = started ? "" : "hidden";
    if (started) requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [started]);

  const begin = useCallback((withSound: boolean) => {
    journey.ready = true;
    setStarted(true);
    soundscape.start(!withSound);
  }, []);

  const onContextLost = useCallback(() => setContextLost(true), []);

  const onReady = useCallback(() => {
    setSceneReady(true);
    // ?autostart skips the title card (useful for sharing a deep link: ?autostart&p=0.62)
    const q = new URLSearchParams(window.location.search);
    if (q.has("autostart")) {
      begin(false);
      const p = parseFloat(q.get("p") ?? "");
      if (!Number.isNaN(p)) {
        requestAnimationFrame(() => {
          ScrollTrigger.refresh();
          const el = document.getElementById("journey")!;
          window.scrollTo(0, el.offsetTop + (el.offsetHeight - window.innerHeight) * p);
        });
      }
    }
  }, [begin]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __poa?: Record<string, unknown> };
      w.__poa = { ...(w.__poa ?? {}), journey };
    }
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-0" aria-hidden>
        {fontsReady && tier && !contextLost && <Scene onReady={onReady} tier={tier} onContextLost={onContextLost} />}
      </div>
      <main className="relative z-10">
        <section id="journey" style={{ height: `${journeyVh}vh` }} aria-label="Jornada pelo Aeroporto Salgado Filho, controlada pela rolagem" />
        <Finale />
      </main>
      {started && (
        <>
          <Callouts />
          <Chapters />
        </>
      )}
      <HUD visible={started} />
      {started && <ScrollProgress />}
      <Cursor />
      <Loader ready={sceneReady || patience} started={started} onBegin={begin} safeMode={tier === "safe"} safeReason={tierReason} />
      {contextLost && (
        <div role="alertdialog" aria-labelledby="gpu-lost-title" className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/90 px-6 backdrop-blur-md">
          <div className="max-w-lg">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-amber">A placa de vídeo reiniciou</p>
            <h2 id="gpu-lost-title" className="font-display text-5xl leading-none text-paper">A cena 3D foi interrompida.</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-paper/75">
              O driver de vídeo encerrou a cena 3D. O documentário pode seguir em modo seguro, com iluminação e efeitos mais leves e a mesma jornada. Este navegador vai lembrar da escolha.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => (window.location.href = window.location.pathname + "?q=safe")} className="rounded-full bg-paper px-6 py-3 text-[13px] font-medium text-ink">
                Recarregar em modo seguro
              </button>
              <button
                onClick={() => {
                  forgetSafeMode();
                  window.location.href = window.location.pathname;
                }}
                className="rounded-full border border-white/20 px-6 py-3 text-[13px] text-paper/80"
              >
                Tentar a qualidade completa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
