"use client";

import { cn } from "@/lib/utils";

interface TimerRingProps {
  secondsLeft: number;
  totalSeconds: number;
  size?: number;
  className?: string;
}

export default function TimerRing({ secondsLeft, totalSeconds, size = 88, className }: TimerRingProps) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const dash = circumference * pct;
  const urgent = pct <= 0.15;
  const warn = pct <= 0.35 && !urgent;
  const color = urgent ? "var(--danger)" : warn ? "var(--warning)" : "var(--primary)";

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={circumference - dash}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 300ms ease" }}
        />
      </svg>
      <span className={cn("absolute font-mono font-bold tabular-nums", urgent ? "text-danger" : "text-foreground", size >= 80 ? "text-xl" : "text-sm")}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}