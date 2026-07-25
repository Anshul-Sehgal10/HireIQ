"use client";

import { useParallax } from "@/lib/useParallax";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

interface ParallaxBlobProps {
  speed?: number;
  className?: string;
  style?: CSSProperties;
}

/** A decorative blurred circle that drifts at its own rate on scroll,
 *  giving the hero section a sense of depth. Purely visual - aria-hidden.
 *
 *  IMPORTANT: position this via `className`/`style` using plain offsets
 *  (top/left/margins), never `translate-x/y` utility classes. The parallax
 *  effect sets `el.style.transform` directly each frame, which overwrites
 *  the *entire* transform - including any centering done via Tailwind's
 *  translate utilities - silently knocking the blob off-position. */
export default function ParallaxBlob({ speed = 0.15, className, style }: ParallaxBlobProps) {
  const ref = useParallax<HTMLDivElement>(speed);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={style}
      className={cn("pointer-events-none absolute z-0", className)}
    />
  );
}