"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

const QUESTION =
  "A customer-facing API you own starts returning 500s intermittently under load. Walk through how you'd triage this in production, right now.";

const FINAL_TEXT =
  "First I'd check the error rate dashboard to see if it's isolated to one region or endpoint. If it correlates with a recent deploy, I'd roll back immediately rather than debugging live.\n\nIf not, I'd pull the pod resource metrics - this smells like connection pool exhaustion under load, so I'd check DB connection counts next.";

const TYPO_POINTS: { at: number; wrong: string }[] = [
  { at: 16, wrong: "kc" },
  { at: 88, wrong: "reg" },
  { at: 205, wrong: "bakc" },
];

const END_HOLD_MS = 3000; // timer keeps ticking this long after typing finishes, then sits at 0
const POST_HOLD_MS = 2600; // pause at 0 before the whole cycle restarts
const URGENT_SECONDS = 5;

interface Step {
  atMs: number; // cumulative elapsed time at which `text` becomes current
  text: string;
}

/**
 * Precomputes the full (cumulative-time, text) schedule up front. Both the
 * displayed text AND the countdown are later derived from one single
 * `elapsed` value read each animation frame - since they share that one
 * source of truth, they can never drift apart or show the timer hitting 0
 * before typing visibly finishes.
 */
function buildSchedule(): { steps: Step[]; typingMs: number } {
  const steps: Step[] = [];
  let text = "";
  let t = 0;

  const push = (delay: number) => {
    t += delay;
    steps.push({ atMs: t, text });
  };

  for (let i = 0; i < FINAL_TEXT.length; i++) {
    const typo = TYPO_POINTS.find((tp) => tp.at === i);
    if (typo) {
      for (const ch of typo.wrong) {
        text += ch;
        push(30 + Math.random() * 45);
      }
      push(320);
      for (let k = 0; k < typo.wrong.length; k++) {
        text = text.slice(0, -1);
        push(28);
      }
      push(150);
    }
    text += FINAL_TEXT[i];
    push(22 + Math.random() * 38);
  }
  return { steps, typingMs: t };
}

function findStepIndex(steps: Step[], elapsed: number): number {
  if (steps.length === 0 || elapsed < steps[0].atMs) return -1;
  let lo = 0;
  let hi = steps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (steps[mid].atMs <= elapsed) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export default function TypingScenarioCard() {
  const [caretOn, setCaretOn] = useState(true);
  const textRef = useRef<HTMLSpanElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setCaretOn((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      if (textRef.current) textRef.current.textContent = FINAL_TEXT;
      if (timeRef.current) timeRef.current.textContent = "0:03";
      if (barRef.current) barRef.current.style.width = "97%";
      return;
    }

    let cancelled = false;
    let rafId: number;
    let restartTimeout: ReturnType<typeof setTimeout>;

    function runCycle() {
      const { steps, typingMs } = buildSchedule();
      const totalMs = typingMs + END_HOLD_MS;
      const start = Date.now();

      const frame = () => {
        if (cancelled) return;
        const elapsed = Date.now() - start;

        const idx = findStepIndex(steps, elapsed);
        const text = idx >= 0 ? steps[idx].text : "";
        if (textRef.current && textRef.current.textContent !== text) {
          textRef.current.textContent = text;
          const scrollEl = scrollRef.current;
          if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
        }

        const remainingMs = Math.max(0, totalMs - elapsed);
        const remainingSeconds = remainingMs / 1000;
        const urgent = remainingSeconds <= URGENT_SECONDS;

        if (timeRef.current) {
          const m = Math.floor(remainingSeconds / 60);
          const s = Math.floor(remainingSeconds % 60);
          timeRef.current.textContent = `${m}:${s.toString().padStart(2, "0")}`;
          timeRef.current.classList.toggle("timer-urgent", urgent);
        }
        if (barRef.current) {
          const elapsedPct = Math.max(0, Math.min(1, elapsed / totalMs));
          barRef.current.style.width = `${elapsedPct * 100}%`;
          barRef.current.classList.toggle("bg-danger", urgent);
          barRef.current.classList.toggle("bg-primary", !urgent);
        }

        if (elapsed < totalMs) {
          rafId = requestAnimationFrame(frame);
        } else {
          restartTimeout = setTimeout(() => {
            if (!cancelled) runCycle();
          }, POST_HOLD_MS);
        }
      };

      rafId = requestAnimationFrame(frame);
    }

    runCycle();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(restartTimeout);
    };
  }, []);

  return (
    <div className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-primary/40 via-border to-primary/10 p-[1px] shadow-2xl shadow-primary/10">
      <div className="rounded-2xl bg-card/70 p-6 backdrop-blur-xl">
        <span className="mb-5 block text-xs font-semibold uppercase tracking-widest text-primary">
          Scenario question
        </span>

        <p className="mb-6 text-sm leading-relaxed text-foreground">{QUESTION}</p>

        <div
          ref={scrollRef}
          className="typing-box-glow scrollbar-none mb-4 h-28 overflow-y-auto rounded-lg border border-border bg-background/60 px-3 py-2.5 text-xs leading-relaxed text-foreground/90"
        >
          <span ref={textRef} className="whitespace-pre-wrap" />
          <span
            className={`inline-block h-3 w-px translate-y-0.5 bg-primary transition-opacity ${
              caretOn ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>

        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Time remaining</span>
          <span ref={timeRef} className="font-mono text-xs font-bold tabular-nums text-foreground" />
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div ref={barRef} className="h-full rounded-full bg-primary" style={{ width: "0%" }} />
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">
          <ShieldCheck size={12} />
          Graded for reasoning, not polish
        </div>
      </div>
    </div>
  );
}