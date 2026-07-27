"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import type { ReactNode } from "react";

/**
 * Thin wrapper so app/layout.tsx and every consumer can keep importing
 * ThemeProvider/useTheme from "@/context/theme" — the actual state engine
 * underneath is next-themes now, not a hand-rolled context.
 *
 * attribute="data-theme" (not the default "class") so it matches the
 * [data-theme='dark'] selectors in globals.css. next-themes injects its own
 * pre-hydration <script> into <html> that sets this attribute before first
 * paint, which is what makes this flash-free — no blocking script needed
 * in layout.tsx anymore.
 *
 * disableTransitionOnChange is back ON: the theme-switch animation is now
 * handled entirely by the View Transition API circle-reveal in
 * ThemeToggle.tsx — a single, unified page-level animation. Leaving normal
 * CSS transitions enabled during the attribute swap let every component's
 * own transition-colors utility fire independently (different durations,
 * different elements finishing at different times), which is exactly what
 * produced the "laggy, out-of-sync" feel. next-themes' built-in
 * disableTransitionOnChange briefly suppresses all CSS transitions during
 * the swap so the circle-reveal is the only visible animation.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * Same external shape the app already used (theme / toggleTheme / setTheme /
 * preference), backed by next-themes' useTheme(). `theme` is always the
 * *resolved* value ("light" | "dark") since that's what components need to
 * decide which icon/tokens to render — "system" is only ever a preference,
 * never something a consumer branches on.
 */
export function useTheme() {
  const { theme, resolvedTheme, setTheme } = useNextTheme();
  const current = (resolvedTheme ?? "light") as "light" | "dark";

  return {
    theme: current,
    preference: (theme ?? "system") as "light" | "dark" | "system",
    setTheme: (pref: "light" | "dark" | "system") => setTheme(pref),
    toggleTheme: () => setTheme(current === "dark" ? "light" : "dark"),
  };
}