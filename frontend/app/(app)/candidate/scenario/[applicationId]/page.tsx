"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";

interface ScenarioQuestion {
  id: string;
  application_id: string;
  question_text: string;
  time_limit_seconds: number;
  started_at: string;
  time_remaining_seconds: number;
}

interface ScenarioResult {
  id: string;
  application_id: string;
  score: number | null;
  ai_summary: string | null;
  time_taken_seconds: number | null;
  paste_detected: boolean;
  tab_switches: number;
  submitted_at: string;
}

type Stage = "loading" | "in_progress" | "submitting" | "done" | "error";

export default function ScenarioPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <ScenarioContent />
    </RoleGuard>
  );
}

function ScenarioContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [question, setQuestion] = useState<ScenarioQuestion | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const pasteDetectedRef = useRef(false);
  const tabSwitchesRef = useRef(0);
  const submittingRef = useRef(false); // guards against double-submit (manual + auto)

  // --- Start the attempt on mount ---
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/applications/${applicationId}/scenario/start`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Failed to start scenario");
        setQuestion(data);
        setTimeLeft(data.time_remaining_seconds);
        setStage("in_progress");
      } catch (e: any) {
        setErrorMsg(e.message);
        setStage("error");
      }
    })();
  }, [applicationId]);

  // --- Anti-gaming signal tracking ---
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) tabSwitchesRef.current += 1;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // --- Countdown, auto-submits at zero ---
  useEffect(() => {
    if (stage !== "in_progress") return;
    if (timeLeft <= 0) {
      submit();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, stage]);

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStage("submitting");
    try {
      const res = await apiFetch(`/applications/${applicationId}/scenario/submit`, {
        method: "POST",
        body: JSON.stringify({
          response_text: answer,
          paste_detected: pasteDetectedRef.current,
          tab_switches: tabSwitchesRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to submit response");
      setResult(data);
      setStage("done");
    } catch (e: any) {
      setErrorMsg(e.message);
      setStage("error");
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const urgent = timeLeft <= 30;

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400 text-sm animate-pulse">Preparing your scenario question…</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-white font-bold text-lg mb-2">Something went wrong</h1>
          <p className="text-red-400 text-sm mb-6">{errorMsg}</p>
          <button
            onClick={() => router.push("/candidate/jobs")}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Back to job feed
          </button>
        </div>
      </div>
    );
  }

  if (stage === "done" && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-white font-bold text-xl mb-1">Response submitted</h1>
          <p className="text-slate-400 text-sm mb-6">
            Your answer has been recorded and factored into your application.
          </p>

          {result.score != null ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Score</p>
              <p className="text-3xl font-bold text-emerald-400">
                {Math.round(result.score * 100)}%
              </p>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-5 mb-4">
              <p className="text-sm text-amber-400">
                Your response was saved, but automatic scoring didn't complete. This won't
                block your application — it'll be reviewed separately.
              </p>
            </div>
          )}

          {result.ai_summary && (
            <div className="mb-6">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Feedback</p>
              <p className="text-sm text-slate-300 leading-relaxed">{result.ai_summary}</p>
            </div>
          )}

          <button
            onClick={() => router.push("/candidate/jobs")}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Back to job feed
          </button>
        </div>
      </div>
    );
  }

  // in_progress or submitting
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
          Scenario question
        </span>
        <span
          className={`text-lg font-mono font-bold tabular-nums ${
            urgent ? "text-red-400" : "text-white"
          }`}
        >
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
      </header>

      <div className="flex-1 max-w-2xl w-full mx-auto px-6 py-10">
        <p className="text-white text-base leading-relaxed mb-8 whitespace-pre-wrap">
          {question?.question_text}
        </p>

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onPaste={() => {
            pasteDetectedRef.current = true;
          }}
          disabled={stage === "submitting"}
          placeholder="Write your response here…"
          rows={10}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 disabled:opacity-50 resize-none"
        />

        <button
          onClick={submit}
          disabled={stage === "submitting" || !answer.trim()}
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
        >
          {stage === "submitting" ? "Submitting…" : "Submit answer"}
        </button>
      </div>
    </div>
  );
}