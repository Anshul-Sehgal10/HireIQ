"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Lock,
  Maximize2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import {
  Card,
  Button,
  Textarea,
  MatchScoreRing,
  TimerRing,
} from "@/components/ui";

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
  meets_threshold: boolean;
  scenario_score_threshold: number;
  requires_override: boolean;
  overrides_remaining: number;
  overrides_unlimited: boolean;
}

interface ViolationResponse {
  violation_count: number;
  rejected: boolean;
  new_question_text: string | null;
  time_remaining_seconds: number;
}

type Stage = "loading" | "in_progress" | "submitting" | "done" | "rejected" | "error";

// Copied into the clipboard instead of the actual question text — the
// point isn't to be clever, just to waste the time of whoever pastes it
// into another tab expecting the real question.
const DECOY_LINES = [
  "Nice try — this question doesn't leave the test window.",
  "Copying the scenario question isn't part of the plan here.",
  "This isn't the question you're looking for. 👀",
];

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
  const stageRef = useRef<Stage>("loading");
  const setStageBoth = (s: Stage) => {
    stageRef.current = s;
    setStage(s);
  };

  const [errorMsg, setErrorMsg] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const pasteDetectedRef = useRef(false);
  const tabSwitchesRef = useRef(0);
  const [violationCount, setViolationCount] = useState(0);
  const [violationNotice, setViolationNotice] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [overriding, setOverriding] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------
  // Start the attempt
  // -------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(
          `/applications/${applicationId}/scenario/start`,
          { method: "POST" },
        );
        const data: ScenarioQuestion = await res.json();
        if (!res.ok) throw new Error((data as any).detail ?? "Failed to start scenario");
        setQuestionText(data.question_text);
        setTimeLeft(data.time_remaining_seconds);
        setTotalTime(data.time_limit_seconds);
        setStageBoth("in_progress");
      } catch (e: any) {
        setErrorMsg(e.message);
        setStageBoth("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  // -------------------------------------------------------------------
  // Fullscreen — a nudge, not load-bearing. Try on entry; browsers that
  // require a user gesture just fall back to the manual button below.
  // -------------------------------------------------------------------
  const requestFullscreen = async () => {
    try {
      if (containerRef.current && !document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      }
    } catch {
      // Silently ignore — some browsers require a click, handled by the
      // visible "Enter focus mode" button instead.
    }
  };

  useEffect(() => {
    if (stage !== "in_progress") return;
    requestFullscreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // -------------------------------------------------------------------
  // Violation reporting — tab switch / paste both funnel through here.
  // Server decides: swap in a fresh question, or reject outright once
  // the pool is exhausted.
  // -------------------------------------------------------------------
  const showNotice = (text: string) => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    setViolationNotice(text);
    noticeTimeoutRef.current = setTimeout(() => setViolationNotice(null), 5000);
  };

  const reportViolation = async (reason: "tab_switch" | "paste") => {
    if (stageRef.current !== "in_progress" || submittingRef.current) return;
    try {
      const res = await apiFetch(
        `/applications/${applicationId}/scenario/violation`,
        { method: "POST", body: JSON.stringify({ reason }) },
      );
      if (!res.ok) return; // never block the test on a network hiccup
      const data: ViolationResponse = await res.json();

      setViolationCount(data.violation_count);

      if (data.rejected) {
        setStageBoth("rejected");
        return;
      }

      if (data.new_question_text) {
        setQuestionText(data.new_question_text);
        setAnswer("");
        setTimeLeft(data.time_remaining_seconds);
        showNotice(
          reason === "tab_switch"
            ? "You switched away from the test — the question has changed. Your previous progress on this answer no longer applies."
            : "Pasted content isn't allowed here — the question has changed. Your previous progress on this answer no longer applies.",
        );
      }
      // new_question_text null + rejected false → time had already hit 0;
      // the normal timeout-triggers-submit effect below handles it.
    } catch {
      // Ignore — anti-cheat reporting should never itself break the test.
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && stageRef.current === "in_progress") {
        tabSwitchesRef.current += 1;
        reportViolation("tab_switch");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  // -------------------------------------------------------------------
  // Countdown — keeps running across question swaps, never resets.
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------
  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStageBoth("submitting");
    try {
      const res = await apiFetch(
        `/applications/${applicationId}/scenario/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            response_text: answer,
            paste_detected: pasteDetectedRef.current,
            tab_switches: tabSwitchesRef.current,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to submit response");
      setResult(data);
      setStageBoth("done");
    } catch (e: any) {
      setErrorMsg(e.message);
      setStageBoth("error");
    }
  };

  const confirmOverride = async () => {
    setOverriding(true);
    try {
      const res = await apiFetch(
        `/applications/${applicationId}/scenario/override`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to apply override");
      setResult(data);
      router.push("/candidate/dashboard");
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setOverriding(false);
    }
  };

  const urgent = totalTime > 0 && timeLeft / totalTime <= 0.15;
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  // -------------------------------------------------------------------
  // Copy sabotage — the question can be read, never lifted out of the
  // test window. Selecting it and hitting copy hands back a decoy line
  // instead of the actual text.
  // -------------------------------------------------------------------
  const handleQuestionCopy = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const decoy = DECOY_LINES[Math.floor(Math.random() * DECOY_LINES.length)];
    e.clipboardData?.setData("text/plain", decoy);
  };

  const handleAnswerPaste = () => {
    pasteDetectedRef.current = true;
    reportViolation("paste");
  };

  // -------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="animate-pulse text-sm text-muted-foreground">
          Preparing your scenario question…
        </p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
            <AlertTriangle size={20} />
          </div>
          <h1 className="mb-2 text-lg font-bold text-foreground">Something went wrong</h1>
          <p className="mb-6 text-sm text-danger">{errorMsg}</p>
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={14} />}
            onClick={() => router.push("/candidate/jobs")}
          >
            Back to job feed
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "rejected") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
            <XCircle size={22} />
          </div>
          <h1 className="mb-2 text-lg font-bold text-foreground">Test ended</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            Your application wasn't submitted — this test was ended due to
            repeated activity outside the test window. This is a fairness
            rule applied equally to every candidate, not a manual decision
            about your application.
          </p>
          <Button className="w-full" onClick={() => router.push("/candidate/jobs")}>
            Back to job feed
          </Button>
        </Card>
      </div>
    );
  }

  if (stage === "done" && result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-lg p-8">
          <h1 className="text-xl font-bold text-foreground">Response submitted</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            Your answer has been recorded and factored into your application.
          </p>

          {result.score != null ? (
            <div className="mb-6 flex items-center gap-5 rounded-xl border border-border bg-muted/40 p-5">
              <MatchScoreRing score={result.score} threshold={result.scenario_score_threshold} size="lg" />
              <div>
                <p className={`text-sm font-semibold ${result.meets_threshold ? "text-success" : "text-warning"}`}>
                  {result.meets_threshold ? "Meets the bar for this role" : "Below this role's bar"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Needed {Math.round(result.scenario_score_threshold * 100)}% to pass automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-warning-border bg-warning-bg p-5">
              <p className="text-sm text-warning-foreground">
                Your response was saved, but automatic scoring didn't complete.
                This won't block your application — it'll be reviewed separately.
              </p>
            </div>
          )}

          {result.requires_override && (
            <div className="mb-6 space-y-3 rounded-xl border border-warning-border bg-warning-bg p-5">
              <p className="text-sm text-warning-foreground">
                Your application hasn't been submitted yet — you can use one
                of your monthly overrides to submit it anyway.
              </p>
              <p className="text-xs text-warning-foreground/80">
                {result.overrides_unlimited
                  ? "Unlimited overrides on your plan."
                  : `${result.overrides_remaining} override${result.overrides_remaining !== 1 ? "s" : ""} remaining this month.`}
              </p>
              <Button
                variant="secondary"
                className="w-full"
                loading={overriding}
                disabled={result.overrides_remaining === 0}
                onClick={confirmOverride}
              >
                {result.overrides_remaining === 0 ? "No overrides remaining" : "Use an override and submit anyway"}
              </Button>
            </div>
          )}

          <Button className="w-full" onClick={() => router.push("/candidate/jobs")}>
            Back to job feed
          </Button>
        </Card>
      </div>
    );
  }

  // in_progress / submitting
  return (
    <div ref={containerRef} className="flex min-h-screen flex-col bg-background">
      {/* ---------------------------------------------------------- */}
      {/* Header — quiet, functional, no visual noise                */}
      {/* ---------------------------------------------------------- */}
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Scenario question
          </span>
          <span className="hidden items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:flex">
            <Lock size={10} />
            {isFullscreen ? "Focus mode active" : "Focus mode off"}
          </span>
          {!isFullscreen && (
            <button
              onClick={requestFullscreen}
              className="hidden items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover sm:flex"
            >
              <Maximize2 size={11} />
              Enter focus mode
            </button>
          )}
        </div>
        <TimerRing secondsLeft={timeLeft} totalSeconds={totalTime} size={52} />
      </header>

      {/* ---------------------------------------------------------- */}
      {/* Transient violation notice — non-blocking, auto-dismisses   */}
      {/* ---------------------------------------------------------- */}
      {violationNotice && (
        <div className="mx-auto mt-4 w-full max-w-2xl px-6">
          <div className="flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-foreground">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <p>{violationNotice}</p>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <Card className={`mb-6 p-6 transition-colors ${urgent ? "border-danger-border" : ""}`}>
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock3 size={13} />
              Answer this scenario in your own words — plain text only.
            </span>
            {violationCount > 0 && (
              <span className="text-warning">
                {violationCount} notice{violationCount !== 1 ? "s" : ""} logged
              </span>
            )}
          </div>
          <p
            className="select-none whitespace-pre-wrap text-base leading-relaxed text-foreground"
            onCopy={handleQuestionCopy}
            onCut={handleQuestionCopy}
            onContextMenu={(e) => e.preventDefault()}
          >
            {questionText}
          </p>
        </Card>

        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onPaste={handleAnswerPaste}
          disabled={stage === "submitting"}
          placeholder="Write your response here…"
          rows={10}
        />
        <div className="mt-1.5 flex justify-end">
          <span className="text-xs text-muted-foreground">
            {wordCount} word{wordCount !== 1 ? "s" : ""}
          </span>
        </div>

        <Button
          className="mt-4 w-full"
          size="lg"
          loading={stage === "submitting"}
          disabled={!answer.trim()}
          onClick={submit}
        >
          Submit answer
        </Button>
      </div>
    </div>
  );
}