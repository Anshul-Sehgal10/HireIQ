"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme";
import { cn } from "@/lib/utils";

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // resolvedTheme is undefined on the server and on the very first client
  // render (next-themes needs a tick to read localStorage/system pref).
  // Rendering a theme-dependent icon before that resolves would mismatch
  // between server and client HTML — so render an inert placeholder of the
  // same footprint until we're safely past hydration.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn("h-8 w-8 rounded-lg", className)} aria-hidden="true" />;
  }

  const isDark = theme === "dark";

  /**
   * Circle-reveal theme switch, anchored to this button.
   *
   * Driven entirely by CSS (see globals.css's `circle-reveal` keyframes),
   * not by a JS Element.animate() call timed off `transition.ready`. That
   * JS-timed approach has a race: the browser's own default crossfade
   * animation on ::view-transition-new(root) can start the instant `ready`
   * resolves, and our custom animate() call — fired a tick later in a
   * .then() — sometimes loses that race, so the default center-crossfade
   * plays instead of our circle. Setting --reveal-x/--reveal-y/--reveal-r
   * as CSS custom properties BEFORE calling startViewTransition, and
   * having the reveal defined as a real CSS animation on
   * ::view-transition-new(root), means the browser runs our animation
   * from the very first frame — nothing else can race ahead of it.
   */
  const handleClick = () => {
    const supportsViewTransition =
      typeof document !== "undefined" && "startViewTransition" in document;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsViewTransition || prefersReducedMotion || !buttonRef.current) {
      toggleTheme();
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const root = document.documentElement;
    root.style.setProperty("--reveal-x", `${x}px`);
    root.style.setProperty("--reveal-y", `${y}px`);
    root.style.setProperty("--reveal-r", `${endRadius}px`);

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        toggleTheme();
      });
    });

    transition.finished.finally(() => {
      root.style.removeProperty("--reveal-x");
      root.style.removeProperty("--reveal-y");
      root.style.removeProperty("--reveal-r");
    });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <Sun
          size={16}
          className={cn(
            "absolute transition-all duration-300 ease-out",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
          )}
        />
        <Moon
          size={16}
          className={cn(
            "absolute transition-all duration-300 ease-out",
            isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
      </span>
    </button>
  );
}