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