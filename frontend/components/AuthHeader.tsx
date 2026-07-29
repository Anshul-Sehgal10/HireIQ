"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface Props {
  mode: "login" | "register";
  onSwitch: () => void;
}

export default function AuthHeader({ mode, onSwitch }: Props) {
  const isLogin = mode === "login";

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-4 sm:px-8">
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

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {isLogin ? "New to HireIQ?" : "Already have an account?"}
        </span>
        <button
          type="button"
          onClick={onSwitch}
          className="inline-flex items-center rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
        >
          {isLogin ? "Sign up" : "Sign in"}
        </button>
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <ThemeToggle />
      </div>
    </header>
  );
}