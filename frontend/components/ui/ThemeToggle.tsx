"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme as useNextTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function ThemeToggle({ className }: { className?: string }) {
  // Talk to next-themes directly here (not the app's useTheme wrapper) so
  // we can force the DOM attribute change synchronously — see note below.
  const { resolvedTheme, setTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn("h-8 w-8 rounded-lg", className)} aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  const handleClick = () => {
    const next = isDark ? "light" : "dark";
    const supportsViewTransition = typeof document !== "undefined" && "startViewTransition" in document;
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsViewTransition || prefersReducedMotion || !buttonRef.current) {
      setTheme(next);
      return;
    }
      const rect = buttonRef.current.getBoundingClientRect();
      // getBoundingClientRect() is viewport-relative, but the view-transition
      // pseudo-element's clip-path is relative to the initial containing block
      // (i.e. page coordinates). Add scroll offset to compensate.
      const x = rect.left + rect.width / 2 + window.scrollX;
      const y = rect.top + rect.height / 2 + window.scrollY;
      
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
        // Set the attribute ourselves, synchronously, inside the same
        // flush as the state update. next-themes applies this attribute
        // in a passive `useEffect`, which flushSync does NOT force to
        // run before this callback returns — without this line the
        // browser can snapshot "after" before the theme has actually
        // changed, so the circle has nothing to reveal. next-themes'
        // own effect still fires right after and writes the same value,
        // so this is a safe, idempotent belt-and-suspenders write.
        root.setAttribute("data-theme", next);
        setTheme(next);
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