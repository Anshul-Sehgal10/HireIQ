"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks progress as the *vertical center of the viewport* sweeps through
 * a section: 0 when the section's top edge is at the viewport's center,
 * 1 when the section's bottom edge is at the viewport's center.
 *
 * This (not scroll-into-view fractions) is what makes "reaches the center
 * of the page" line up exactly with any per-row activation math derived
 * from the same element's internal layout - both are driven by one number.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ticking = false;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const p = (viewportCenter - rect.top) / rect.height;
      setProgress(Math.max(0, Math.min(1, p)));
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
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { ref, progress };
}