"use client";

import { useEffect, useRef } from "react";

/**
 * Attaches a scroll-driven parallax transform to the returned ref.
 * `speed` is a multiplier on scrollY — positive drifts the element down
 * as the page scrolls, negative drifts it up, creating depth between
 * layers moving at different rates. No-ops under prefers-reduced-motion.
 */
export function useParallax<T extends HTMLElement>(speed: number = 0.2) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let ticking = false;
    const update = () => {
      el.style.transform = `translate3d(0, ${window.scrollY * speed}px, 0)`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return ref;
}