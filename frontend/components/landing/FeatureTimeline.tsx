"use client";

import { useEffect, useState } from "react";
import { Timer, Target, MessagesSquare, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { useScrollProgress } from "@/lib/useScrollProgress";
import ScrollReveal from "./ScrollReveal";

const FEATURES = [
  {
    icon: Timer,
    title: "Timed, isolated scenario tests",
    description:
      "A fullscreen, locked environment with a countdown timer and anti-gaming signals - tab-switch detection, paste detection, keystroke cadence - surfaced to the employer, never auto-rejecting.",
  },
  {
    icon: Target,
    title: "Semantic resume matching",
    description:
      "Every resume and job description is embedded and compared by cosine similarity before an application is even allowed through, so nobody wastes time on a guaranteed rejection.",
  },
  {
    icon: MessagesSquare,
    title: "Pipeline broadcast channels",
    description:
      "Once shortlisted, candidates join a real-time channel per job - no more mass emails, no more silence. Rejected candidates are removed automatically, with a reason.",
  },
  {
    icon: Gauge,
    title: "Live token-cost dashboard",
    description:
      "Employers see exactly what every scenario evaluation and resume match costs in real time - transparent, AWS-style usage billing, not a black box.",
  },
  {
    icon: ShieldCheck,
    title: "Verified employers only",
    description:
      "Business email + company verification before any job goes live, so candidates aren't burning override quota on fake postings.",
  },
  {
    icon: Sparkles,
    title: "A feed built for you, not everyone",
    description:
      "Candidates see jobs ranked by their actual resume embedding - not a generic firehose. Low-fit roles are hidden by default, not spammed.",
  },
];

// Every row renders at exactly this height so pixel math (SVG path, icon
// activation thresholds) stays exactly in sync with real DOM layout.
const ROW_HEIGHT = 232;
const ICON_COL_WIDTH = 112;
// How far the curve bulges from center, in px. Kept well inside the
// icon-column-half + card-gap clearance below so the line can never pass
// under a card.
const BULGE = 56;
// Gap between a card's inner edge and the icon column, in px.
const CARD_GAP = 44;

export default function FeatureTimeline() {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const [width, setWidth] = useState(0);
  const n = FEATURES.length;
  const totalHeight = n * ROW_HEIGHT;

  // Measure actual rendered width so the SVG can use a 1:1 pixel
  // coordinate system (no viewBox stretching) - that non-uniform stretch
  // combined with non-scaling-stroke previously caused a "line glows at
  // top and bottom, gap in the middle" artifact.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowCenterY = (i: number) => i * ROW_HEIGHT + ROW_HEIGHT / 2;
  const centerX = width / 2;

  let path = "";
  if (width > 0) {
    path = `M ${centerX} ${rowCenterY(0)}`;
    for (let i = 1; i < n; i++) {
      const dir = i % 2 === 1 ? -1 : 1;
      const midY = (rowCenterY(i - 1) + rowCenterY(i)) / 2;
      path += ` Q ${centerX + dir * BULGE} ${midY}, ${centerX} ${rowCenterY(i)}`;
    }
  }

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-5xl">
      {width > 0 && (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${width} ${totalHeight}`}
          fill="none"
          aria-hidden="true"
        >
          <path d={path} stroke="var(--border)" strokeWidth={2} />
          <path
            d={path}
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - progress}
            style={{ transition: "stroke-dashoffset 120ms linear" }}
          />
        </svg>
      )}

      <div className="relative">
        {FEATURES.map((item, i) => {
          const Icon = item.icon;
          const isLeft = i % 2 === 0;
          const active = progress >= rowCenterY(i) / totalHeight;

          return (
            <ScrollReveal key={item.title}>
              <div
                className="grid items-center"
                style={{ height: ROW_HEIGHT, gridTemplateColumns: `1fr ${ICON_COL_WIDTH}px 1fr` }}
              >
                <div>{isLeft && <FeatureCardBody item={item} align="right" gap={CARD_GAP} active={active} />}</div>

                <div className="flex items-center justify-center">
                  {/* Opaque bg-card at all times (never a translucent
                      bg-primary/10) so the SVG line underneath never shows
                      through the icon circle, active or not. */}
                  <div
                    className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500 ${
                      active
                        ? "icon-glow scale-105 border-primary bg-card text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Icon size={24} />
                  </div>
                </div>

                <div>{!isLeft && <FeatureCardBody item={item} align="left" gap={CARD_GAP} active={active} />}</div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  );
}

function FeatureCardBody({
  item,
  align,
  gap,
  active,
}: {
  item: { title: string; description: string };
  align: "left" | "right";
  gap: number;
  active: boolean;
}) {
  return (
    <div
      style={align === "right" ? { marginRight: gap } : { marginLeft: gap }}
      className={`rounded-xl border bg-card/50 p-5 shadow-lg shadow-black/5 backdrop-blur-md transition-colors duration-500 ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "border-primary/30" : "border-border/70"}`}
    >
      <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
    </div>
  );
}