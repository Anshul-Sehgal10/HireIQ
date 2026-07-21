"use client";

import { cn } from "@/lib/utils";

interface MatchScoreRingProps {
  score: number; // 0–1
  size?: "sm" | "md" | "lg";
  threshold?: number;
  label?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 36, stroke: 3.5, font: "text-[10px]" },
  md: { box: 52, stroke: 4.5, font: "text-xs" },
  lg: { box: 84, stroke: 6, font: "text-lg" },
};

export default function MatchScoreRing({ score, size = "md", threshold, label, className }: MatchScoreRingProps) {
  const { box, stroke, font } = SIZE_MAP[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, score));
  const dash = circumference * pct;

  const color =
    threshold != null
      ? pct >= threshold
        ? "var(--success)"
        : "var(--warning)"
      : pct >= 0.7
        ? "var(--success)"
        : pct >= 0.4
          ? "var(--warning)"
          : "var(--danger)";

  return (
    <div className={cn("relative inline-flex shrink-0 flex-col items-center justify-center", className)}>
      <svg width={box} height={box} className="-rotate-90" viewBox={`0 0 ${box} ${box}`}>
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - dash}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
      </svg>
      <span className={cn("absolute font-bold tabular-nums text-foreground", font)}>{Math.round(pct * 100)}%</span>
      {label && <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>}
    </div>
  );
}