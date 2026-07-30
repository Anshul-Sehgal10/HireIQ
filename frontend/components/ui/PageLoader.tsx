import { cn } from "@/lib/utils";

interface PageLoaderProps {
  label?: string;
  className?: string;
}

/**
 * Full-screen branded loader — two counter-rotating rings around a pulsing
 * center dot, plus a fading-in label. Replaces the bare `animate-pulse` text
 * used across RoleGuard, the OAuth callback, and similar "waiting" screens.
 */
export default function PageLoader({ label = "Loading…", className }: PageLoaderProps) {
  return (
    <div className={cn("flex min-h-screen flex-col items-center justify-center gap-5 bg-background", className)}>
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span
          className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary"
          style={{ animationDuration: "1.1s" }}
        />
        <span className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-primary/10 border-b-primary/60" />
        <span className="h-2.5 w-2.5 animate-pulse-scale rounded-full bg-primary" />
      </div>
      <p className="animate-fade-in text-sm text-muted-foreground">{label}</p>
    </div>
  );
}