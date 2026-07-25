"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const ROW_HEIGHT = 232;
const ICON_COL_WIDTH = 112;
const BULGE = 56;
const CARD_GAP = 44;
const N = FEATURES.length;
const TOTAL_HEIGHT = N * ROW_HEIGHT;

// Constant regardless of width - each row's activation point as a fraction
// of total scroll progress. Computed once at module scope since ROW_HEIGHT
// is fixed, so this never needs to be recalculated per frame or per resize.
const ROW_THRESHOLDS = FEATURES.map((_, i) => (i * ROW_HEIGHT + ROW_HEIGHT / 2) / TOTAL_HEIGHT);

interface Sample {
  y: number;
  frac: number;
}

function yToLengthFraction(targetY: number, samples: Sample[]): number {
  if (samples.length === 0) return 0;
  const last = samples.length - 1;
  if (targetY <= samples[0].y) return samples[0].frac;
  if (targetY >= samples[last].y) return samples[last].frac;

  let lo = 0;
  let hi = last;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].y < targetY) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = (targetY - a.y) / (b.y - a.y || 1);
  return a.frac + t * (b.frac - a.frac);
}

function findStepIndex(steps: Sample[], elapsed: number): number {
  return -1; // unused placeholder removed below
}

export default function FeatureTimeline() {
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackPathRef = useRef<SVGPathElement>(null);
  const progressPathRef = useRef<SVGPathElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeRef = useRef<boolean[]>(new Array(N).fill(false));
  const samplesRef = useRef<Sample[]>([]);

  const centerX = width / 2;
  const rowCenterY = (i: number) => i * ROW_HEIGHT + ROW_HEIGHT / 2;

  let path = "";
  if (width > 0) {
    path = `M ${centerX} ${rowCenterY(0)}`;
    for (let i = 1; i < N; i++) {
      const dir = i % 2 === 1 ? -1 : 1;
      const midY = (rowCenterY(i - 1) + rowCenterY(i)) / 2;
      path += ` Q ${centerX + dir * BULGE} ${midY}, ${centerX} ${rowCenterY(i)}`;
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-sample the rendered path only when it actually changes (i.e. on
  // resize) - not per scroll frame.
  useEffect(() => {
    const pathEl = trackPathRef.current;
    if (!pathEl || width === 0) return;
    const total = pathEl.getTotalLength();
    const steps = 300;
    const table: Sample[] = [];
    for (let i = 0; i <= steps; i++) {
      const len = (total * i) / steps;
      const pt = pathEl.getPointAtLength(len);
      table.push({ y: pt.y, frac: len / total });
    }
    samplesRef.current = table;
  }, [path, width]);

  // The actual per-frame work: direct DOM writes only, no React re-render.
  // This is what removes the lag - recomputing the SVG path string and
  // re-rendering 6 rows 60x/sec was the bottleneck before.
  const handleProgress = useCallback((progress: number) => {
    if (progressPathRef.current) {
      const lengthFrac = yToLengthFraction(progress * TOTAL_HEIGHT, samplesRef.current);
      progressPathRef.current.style.strokeDashoffset = String(1 - lengthFrac);
    }

    for (let i = 0; i < N; i++) {
      const active = progress >= ROW_THRESHOLDS[i];
      if (activeRef.current[i] === active) continue;
      activeRef.current[i] = active;

      const icon = iconRefs.current[i];
      if (icon) {
        icon.classList.toggle("icon-glow", active);
        icon.classList.toggle("scale-105", active);
        icon.classList.toggle("border-primary", active);
        icon.classList.toggle("text-primary", active);
        icon.classList.toggle("border-border", !active);
        icon.classList.toggle("text-muted-foreground", !active);
      }
      const card = cardRefs.current[i];
      if (card) {
        card.classList.toggle("border-primary/30", active);
        card.classList.toggle("border-border/70", !active);
      }
    }
  }, []);

  const scrollRef = useScrollProgress<HTMLDivElement>(handleProgress);

  // Merge the resize-observer ref and the scroll-progress ref onto the
  // same element without fighting each other.
  const setContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    },
    [scrollRef],
  );

  return (
    <>
      {/* -------------------------------------------------------------- */}
      {/* Mobile / tablet (< lg): simple stacked list, no scroll-driven   */}
      {/* zigzag layout - the fixed pixel grid + SVG connector doesn't    */}
      {/* have room to breathe below desktop widths.                     */}
      {/* -------------------------------------------------------------- */}
      <div className="space-y-3.5 lg:hidden">
        {FEATURES.map((item) => {
          const Icon = item.icon;
          return (
            <ScrollReveal key={item.title}>
              <div className="flex items-start gap-3.5 rounded-xl border border-border/70 bg-card/50 p-4 shadow-sm backdrop-blur-md sm:gap-4 sm:p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary sm:h-11 sm:w-11">
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Desktop (lg+): interactive scroll-driven zigzag timeline        */}
      {/* -------------------------------------------------------------- */}
      <div ref={setContainerRef} className="relative mx-auto hidden w-full max-w-5xl lg:block">
        {width > 0 && (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${width} ${TOTAL_HEIGHT}`}
            fill="none"
            aria-hidden="true"
          >
            <path ref={trackPathRef} d={path} stroke="var(--border)" strokeWidth={2} />
            <path
              ref={progressPathRef}
              d={path}
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1}
            />
          </svg>
        )}

        <div className="relative">
          {FEATURES.map((item, i) => {
            const Icon = item.icon;
            const isLeft = i % 2 === 0;

            return (
              <ScrollReveal key={item.title}>
                <div
                  className="grid items-center"
                  style={{ height: ROW_HEIGHT, gridTemplateColumns: `1fr ${ICON_COL_WIDTH}px 1fr` }}
                >
                  <div>
                    {isLeft && (
                      <div
                        ref={(el) => { cardRefs.current[i] = el; }}
                        style={{ marginRight: CARD_GAP }}
                        className="rounded-xl border border-border/70 bg-card/50 p-5 text-right shadow-lg shadow-black/5 backdrop-blur-md transition-colors duration-500"
                      >
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    <div
                      ref={(el) => { iconRefs.current[i] = el; }}
                      className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-all duration-500"
                    >
                      <Icon size={24} />
                    </div>
                  </div>

                  <div>
                    {!isLeft && (
                      <div
                        ref={(el) => { cardRefs.current[i] = el; }}
                        style={{ marginLeft: CARD_GAP }}
                        className="rounded-xl border border-border/70 bg-card/50 p-5 text-left shadow-lg shadow-black/5 backdrop-blur-md transition-colors duration-500"
                      >
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </>
  );
}