"use client";

import { useEffect, useRef } from "react";

/**
 * Drives a callback every animation frame with the current scroll progress
 * of the attached element (0 when its top hits viewport-center, 1 when its
 * bottom does) — without ever calling setState. The previous version used
 * React state, which meant every scroll tick re-rendered the entire
 * consuming component tree (recomputing SVG paths, re-running lookups,
 * re-rendering every row) at 60fps. Driving updates through refs/direct
 * DOM writes instead keeps the main thread free — this is the same
 * pattern used by the hero's typing-card timer.
 */
export function useScrollProgress<T extends HTMLElement>(callback: (progress: number) => void) {
  const ref = useRef<T | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const viewportCenter = window.innerHeight / 2;
        const p = (viewportCenter - rect.top) / rect.height;
        callbackRef.current(Math.max(0, Math.min(1, p)));
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return ref;
}