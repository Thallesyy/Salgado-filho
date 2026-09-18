"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PHOTOS, src } from "@/lib/photos";

const ease = [0.76, 0, 0.24, 1] as const;

export default function Loader({
  ready,
  started,
  onBegin,
  safeMode = false,
  safeReason = "",
}: {
  ready: boolean;
  started: boolean;
  onBegin: (sound: boolean) => void;
  safeMode?: boolean;
  safeReason?: string;
}) {
  return (
    <AnimatePresence>
      {!started && (
        <motion.div
          key="loader"
          className="grain fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-ink px-5 py-6 md:px-12 md:py-10"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 1.4, ease }}
        >
          {/* foto real de abertura, com movimento lento */}
          <motion.div
            aria-hidden
            className="absolute inset-0 -z-10"
            initial={{ scale: 1.12, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 6, ease: "easeOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src("patio")} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/60" />
            <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_60%,rgba(7,8,10,0.2),rgba(7,8,10,0.92))]" />
          </motion.div>

          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-dim md:text-[11px]">
            <span>POA · SBPA</span>
            <span className="hidden sm:inline">29°59′41″S 51°10′16″O</span>
            <span>Documentário interativo</span>
          </div>

          <div className="relative">
            <motion.p
              className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-amber md:mb-5 md:text-[11px]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 1 }}
            >
              Porto Alegre · Rio Grande do Sul
            </motion.p>
            <h1 className="font-display text-[17vw] leading-[0.86] tracking-[-0.02em] text-paper md:text-[12.5vw]">
              {"Salgado Filho".split("").map((ch, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ y: "0.6em", opacity: 0, filter: "blur(12px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: 0.3 + i * 0.045, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  {ch === " " ? " " : ch}
                </motion.span>
              ))}
            </h1>
            <motion.p
              className="mt-5 max-w-md text-balance text-[15px] leading-relaxed text-dim md:mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 1.2 }}
            >
              Uma viagem da calçada de embarque ao voo ao pôr do sol sobre o Guaíba, contada pelo aeroporto que liga o Rio Grande do Sul ao mundo.
            </motion.p>
            <motion.p
              className="mt-4 font-mono text-[10px] leading-relaxed tracking-[0.12em] text-dim/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6, duration: 1.2 }}
            >
              Foto: {PHOTOS.patio.legenda}. {PHOTOS.patio.autor}, {PHOTOS.patio.licenca}
            </motion.p>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-dim md:text-[11px]">
              <AnimatePresence mode="wait">
                {ready ? (
                  <motion.span key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-paper">
                    {safeMode ? (
                      <>
                        Modo gráfico seguro <span className="normal-case tracking-normal text-dim">({safeReason})</span>
                      </>
                    ) : (
                      "Cena pronta, melhor com fones de ouvido"
                    )}
                  </motion.span>
                ) : (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
                    Montando o aeroporto, revelando as imagens
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                disabled={!ready}
                onClick={() => onBegin(false)}
                className="rounded-full border border-white/15 px-5 py-3.5 text-[14px] text-dim transition hover:border-white/40 hover:text-paper disabled:opacity-30 sm:py-3 sm:text-[13px]"
              >
                Começar em silêncio
              </button>
              <button
                disabled={!ready}
                onClick={() => onBegin(true)}
                className="group relative overflow-hidden rounded-full bg-paper px-6 py-3.5 text-[14px] font-medium text-ink transition disabled:opacity-30 sm:py-3 sm:text-[13px]"
              >
                <span className="relative z-10">Começar com som</span>
                <span className="absolute inset-0 -translate-x-full bg-amber transition-transform duration-500 group-hover:translate-x-0" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
