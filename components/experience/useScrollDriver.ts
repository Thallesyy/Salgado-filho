"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect } from "react";
import { finaleMV, journey, progressMV, velocityMV } from "@/lib/journey";

/**
 * Scroll → progress. GSAP ScrollTrigger scrubs a proxy object with inertia
 * (scrub: 1.2 s), which gives the camera its weight: flick the wheel and the
 * dolly glides to a stop instead of snapping.
 */
export function useScrollDriver() {
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
    journey.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scrub = journey.reducedMotion ? 0.4 : 1.2;
    const proxy = { p: 0, f: 0 };
    const ctx = gsap.context(() => {
      gsap.to(proxy, {
        p: 1,
        ease: "none",
        scrollTrigger: {
          trigger: "#journey",
          start: "top top",
          end: "bottom bottom",
          scrub,
          onUpdate: (self) => {
            journey.target = self.progress;
          },
        },
      });
      gsap.to(proxy, {
        f: 1,
        ease: "none",
        // refresh last: the pinned timeline inside #finale changes its height
        scrollTrigger: { trigger: "#finale", start: "top bottom", end: "bottom bottom", scrub, refreshPriority: -1 },
      });
    });

    let last = proxy.p;
    const tick = (_time: number, deltaMs: number) => {
      const dt = Math.max(deltaMs / 1000, 1e-3);
      journey.progress = proxy.p;
      journey.finale = proxy.f;
      const v = (proxy.p - last) / dt;
      last = proxy.p;
      journey.velocity += (v - journey.velocity) * Math.min(1, dt * 8);
      if (!journey.capturing) {
        journey.render = proxy.p;
        journey.finaleRender = proxy.f;
      }
      progressMV.set(proxy.p);
      finaleMV.set(proxy.f);
      velocityMV.set(journey.velocity);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      ctx.revert();
    };
  }, []);
}

export function scrollToProgress(p: number) {
  const el = document.getElementById("journey");
  if (!el) return;
  const max = el.offsetHeight - window.innerHeight;
  const y = el.offsetTop + max * p;
  const distance = Math.abs(window.scrollY - y) / window.innerHeight;
  gsap.to(window, { scrollTo: y, duration: Math.min(6, 1.2 + distance * 0.08), ease: "power2.inOut" });
}
