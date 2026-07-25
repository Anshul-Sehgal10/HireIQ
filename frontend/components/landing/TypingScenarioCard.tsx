"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

const QUESTION =
  "A customer-facing API you own starts returning 500s intermittently under load. Walk through how you'd triage this in production, right now.";

const FINAL_TEXT =
  "First I'd check the error rate dashboard to see if it's isolated to one region or endpoint. If it correlates with a recent deploy, I'd roll back immediately rather than debugging live.\n\nIf not, I'd pull the pod resource metrics - this smells like connection pool exhaustion under load, so I'd check DB connection counts next.";

// Character offsets in FINAL_TEXT where the "candidate" pauses, types a
// wrong fragment, notices, and backspaces it before continuing correctly.
const TYPO_POINTS: { at: number; wrong: string }[] = [
  { at: 16, wrong: "kc" },
  { at: 88, wrong: "reg" },
  { at: 205, wrong: "bakc" },
];

const END_HOLD_SECONDS = 3; // timer keeps ticking this long after typing finishes, then sits at 0
const POST_HOLD_MS = 2600; // pause at 0 before the whole cycle restarts
const URGENT_THRESHOLD = 10; // seconds remaining at which the timer goes red

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Step {
  delay: number;
  text: string;
}

/**
 * Precomputes the full sequence of (delay, resulting-text) steps up front,
 * including the typo-and-correct detours. Because this schedule is built
 * once and then both typed out AND summed for the countdown's total
 * duration, the displayed timer is guaranteed to reach zero exactly
 * END_HOLD_SECONDS after the last character lands - no drift between the
 * two, unlike an independently-ticking fixed countdown.
 */
function buildSchedule(): Step[] {
  const steps: Step[] = [];
  let text = "";

  for (let i = 0; i < FINAL_TEXT.length; i++) {
    const typo = TYPO_POINTS.find((t) => t.at === i);
    if (typo) {
      for (const ch of typo.wrong) {
        text += ch;
        steps.push({ delay: 30 + Math.random() * 45, text });
      }
      steps.push({ delay: 320, text });
      for (let k = 0; k < typo.wrong.length; k++) {
        text = text.slice(0, -1);
        steps.push({ delay: 28, text });
      }
      steps.push({ delay: 150, text });
    }
    text += FINAL_TEXT[i];
    steps.push({ delay: 22 + Math.random() * 38, text });
  }
  return steps;
}

export default function TypingScenarioCard() {
  const [displayed, setDisplayed] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [caretOn, setCaretOn] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalMsRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setCaretOn((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayed]);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplayed(FINAL_TEXT);
      setSecondsLeft(END_HOLD_SECONDS);
      setTotalSeconds(END_HOLD_SECONDS);
      return;
    }

    let cancelled = false;
    let tickId: ReturnType<typeof setInterval> | null = null;

    async function runCycle() {
      const schedule = buildSchedule();
      const typingMs = schedule.reduce((sum, s) => sum + s.delay, 0);
      const totalMs = typingMs + END_HOLD_SECONDS * 1000;

      totalMsRef.current = totalMs;
      startRef.current = Date.now();
      setTotalSeconds(Math.ceil(totalMs / 1000));
      setDisplayed("");

      if (tickId) clearInterval(tickId);
      tickId = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        setSecondsLeft(Math.max(0, Math.ceil((totalMsRef.current - elapsed) / 1000)));
      }, 200);

      for (const step of schedule) {
        if (cancelled) return;
        setDisplayed(step.text);
        await wait(step.delay);
      }
      if (cancelled) return;

      await wait(END_HOLD_SECONDS * 1000); // let the clock finish counting down to 0
      if (tickId) clearInterval(tickId);
      if (cancelled) return;

      await wait(POST_HOLD_MS);
      if (!cancelled) runCycle();
    }

    runCycle();
    return () => {
      cancelled = true;
      if (tickId) clearInterval(tickId);
    };
  }, []);

  const urgent = secondsLeft <= URGENT_THRESHOLD;
  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const elapsedPct = totalSeconds > 0 ? 1 - Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;

  return (
    <div className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-primary/40 via-border to-primary/10 p-[1px] shadow-2xl shadow-primary/10">
      <div className="rounded-2xl bg-card/70 p-6 backdrop-blur-xl">
        <span className="mb-5 block text-xs font-semibold uppercase tracking-widest text-primary">
          Scenario question
        </span>

        <p className="mb-6 text-sm leading-relaxed text-foreground">&ldquo;{QUESTION}&rdquo;</p>

        <div
          ref={scrollRef}
          className="typing-box-glow scrollbar-none mb-4 h-28 overflow-y-auto rounded-lg border border-border bg-background/60 px-3 py-2.5 text-xs leading-relaxed text-foreground/90"
        >
          <span className="whitespace-pre-wrap">{displayed}</span>
          <span
            className={`inline-block h-3 w-px translate-y-0.5 bg-primary transition-opacity ${
              caretOn ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>

        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Time remaining</span>
          <span
            className={`font-mono text-xs font-bold tabular-nums transition-colors ${
              urgent ? "timer-urgent" : "text-foreground"
            }`}
          >
            {minutes}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ease-linear ${
              urgent ? "bg-danger" : "bg-primary"
            }`}
            style={{ width: `${elapsedPct * 100}%` }}
          />
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">
          <ShieldCheck size={12} />
          Graded for reasoning, not polish
        </div>
      </div>
    </div>
  );
}