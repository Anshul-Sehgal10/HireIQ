"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";

/**
 * Landing-page navbar: fixed liquid-glass pill that slides up and out of
 * view on scroll-down and glides back in on scroll-up (or once you're back
 * near the top).
 *
 * The show/hide transition is driven via inline `style` (not Tailwind
 * utility classes) so it has the highest possible specificity and can never
 * be silently overridden or fought over by other stylesheet rules — this
 * is what guarantees the slide is always animated, not an instant jump.
 */
export default function LandingHeader() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    const HIDE_THRESHOLD = 80; // don't hide until scrolled past the hero's top
    const DELTA = 4; // ignore sub-pixel/trackpad jitter

    const update = () => {
      const y = window.scrollY;
      const diff = y - lastY.current;

      if (y < HIDE_THRESHOLD) {
        setHidden(false);
      } else if (diff > DELTA) {
        setHidden(true);
      } else if (diff < -DELTA) {
        setHidden(false);
      }

      lastY.current = y;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      style={{
        transform: hidden ? "translateY(-130%)" : "translateY(0)",
        opacity: hidden ? 0 : 1,
        transition:
          "transform 420ms cubic-bezier(0.65, 0, 0.35, 1), opacity 420ms cubic-bezier(0.65, 0, 0.35, 1)",
        willChange: "transform, opacity",
      }}
      className="fixed inset-x-0 top-3 z-40 mx-auto w-full max-w-5xl px-3 sm:top-4 sm:px-4"
    >
      <div className="glass-nav flex h-13 items-center justify-between rounded-full px-3.5 sm:h-14 sm:px-5">
        <Link href="/" className="group flex items-center gap-2 sm:gap-2.5">
          <Image
            src="/Logo.png"
            alt="HireIQ logo"
            width={24}
            height={24}
            priority
            className="h-8 w-8 shrink-0 rounded-full object-contain transition-transform duration-300 group-hover:scale-125 sm:h-[22px] sm:w-[22px]"
          />
          <span className="text-sm font-bold tracking-tight sm:text-base">HireIQ</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a href="#scenario-engine" className="hover:text-foreground transition-colors">
            Scenario Engine
          </a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#for-employers" className="hover:text-foreground transition-colors">
            For employers
          </a>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/auth/login"
            className="hidden sm:inline-flex h-8 items-center px-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link href="/auth/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}