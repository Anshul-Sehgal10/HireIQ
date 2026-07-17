"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface Props {
  mode: "login" | "register";
}

export default function AuthHeader({ mode }: Props) {
  const router = useRouter();
  const isLogin = mode === "login";
  const targetHref = isLogin ? "/auth/register" : "/auth/login";

  const handleSwitch = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    // Use the native View Transitions API when available for a smooth
    // cross-fade between the two pages; plain navigation otherwise.
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      // @ts-expect-error — experimental API, not yet in the TS DOM lib
      document.startViewTransition(() => router.push(targetHref));
    } else {
      router.push(targetHref);
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles size={16} />
        </span>
        <span className="text-lg font-bold tracking-tight text-foreground">HireIQ</span>
      </Link>

      <div className="flex items-center gap-2.5">
        <Link
          href={targetHref}
          onClick={handleSwitch}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <span className="hidden sm:inline">{isLogin ? "New here?" : "Already have an account?"}</span>
          <span className="font-semibold text-primary">{isLogin ? "Sign up" : "Sign in"}</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}