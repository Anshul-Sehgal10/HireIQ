import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "primary";

interface BadgeProps {
  variant?: BadgeVariant;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground border-border",
  success: "bg-success-bg text-success-foreground border-success-border",
  warning: "bg-warning-bg text-warning-foreground border-warning-border",
  danger: "bg-danger-bg text-danger-foreground border-danger-border",
  primary: "bg-primary/10 text-primary border-primary/20",
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  primary: "bg-primary",
};

export default function Badge({ variant = "default", dot = false, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[variant])} />}
      {children}
    </span>
  );
}