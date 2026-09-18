"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef } from "react";
import { TIMELINE } from "@/lib/content";
import { PHOTOS, src } from "@/lib/photos";

/** Pinned section: vertical scroll drives a horizontal pass through a century of dates. */
export default function Timeline() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(min-width: 768px)", () => {
        const t = track.current!;
        const distance = () => t.scrollWidth - window.innerWidth + 96;
        const tween = gsap.to(t, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section.current,
            start: "top top",
            end: () => "+=" + distance(),
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        gsap.to(bar.current, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: section.current, start: "top top", end: () => "+=" + distance(), scrub: 1 },
        });
        t.querySelectorAll<HTMLElement>("[data-event]").forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0.15, y: 60, filter: "blur(6px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              ease: "none",
              scrollTrigger: { trigger: el, containerAnimation: tween, start: "left 92%", end: "left 55%", scrub: true },
            },
          );
          const year = el.querySelector("[data-year]");
          if (year)
            gsap.fromTo(year, { xPercent: 18 }, { xPercent: -8, ease: "none", scrollTrigger: { trigger: el, containerAnimation: tween, start: "left right", end: "right left", scrub: true } });
        });
      });
      mm.add("(max-width: 767px)", () => {
        track.current!.querySelectorAll<HTMLElement>("[data-event]").forEach((el) => {
          gsap.fromTo(el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, scrollTrigger: { trigger: el, start: "top 90%", end: "top 60%", scrub: true } });
        });
      });
    }, section);
    return () => {
      ctx.revert();
      mm.revert();
    };
  }, []);

  return (
    <section ref={section} className="relative overflow-hidden md:h-screen" aria-labelledby="timeline-title">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/0 via-ink/55 to-ink/70" />
      <div className="relative flex h-full flex-col justify-center px-5 py-24 md:py-0">
        <div className="mb-10 flex items-end justify-between gap-6 md:px-11">
          <div>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-amber md:text-[11px]">Linha do tempo</p>
            <h2 id="timeline-title" className="font-display text-4xl leading-none text-paper md:text-7xl">
              De 1923 a 2025
            </h2>
          </div>
          <div className="hidden w-72 md:block">
            <div className="h-px w-full bg-white/15">
              <div ref={bar} className="h-px w-full origin-left scale-x-0 bg-amber" />
            </div>
          </div>
        </div>
        <div ref={track} className="flex flex-col gap-10 md:flex-row md:gap-0 md:pl-11 md:will-change-transform">
          {TIMELINE.map((e, i) => (
            <article key={e.year + e.title} data-event className="relative md:w-[27rem] md:shrink-0 md:pr-16">
              <div className="mb-6 hidden items-center gap-3 md:flex">
                <span className="block h-2 w-2 rounded-full bg-amber" />
                <span className="h-px flex-1 bg-white/15" />
              </div>
              <div data-year className="font-display text-[5.5rem] leading-none text-transparent [-webkit-text-stroke:1px_rgba(243,239,231,0.55)] md:text-[8.5rem]">
                {e.year}
              </div>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-amber">
                {String(i + 1).padStart(2, "0")} {e.date ? `· ${e.date}` : ""}
              </p>
              <h3 className="mt-3 font-display text-3xl text-paper md:text-4xl">{e.title}</h3>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-paper/75">{e.text}</p>
              {e.photo && PHOTOS[e.photo] && (
                <figure className="mt-5 max-w-[22rem]">
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src(e.photo, true)} alt={PHOTOS[e.photo].alt} loading="lazy" decoding="async" className="block aspect-[16/10] w-full object-cover" />
                  </div>
                  <figcaption className="mt-2 font-mono text-[10px] leading-relaxed tracking-[0.12em] text-dim">
                    {PHOTOS[e.photo].autor}, {PHOTOS[e.photo].licenca}
                  </figcaption>
                </figure>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
