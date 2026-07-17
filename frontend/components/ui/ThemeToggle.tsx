"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme";
import { cn } from "@/lib/utils";

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}