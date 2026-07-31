"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock3 } from "lucide-react";
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
  const [totalTime, setTotalTime] = useState(0);
  const pasteDetectedRef = useRef(false);
  const tabSwitchesRef = useRef(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const submittingRef = useRef(false);
  const [overriding, setOverriding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(
          `/applications/${applicationId}/scenario/start`,
          { method: "POST" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Failed to start scenario");
        setQuestion(data);
        setTimeLeft(data.time_remaining_seconds);
        setTotalTime(data.time_limit_seconds);
        setStage("in_progress");
      } catch (e: any) {
        setErrorMsg(e.message);
        setStage("error");
      }
    })();
  }, [applicationId]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchesRef.current += 1;
        setTabSwitchCount(tabSwitchesRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

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
      setStage("done");
    } catch (e: any) {
      setErrorMsg(e.message);
      setStage("error");
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

      // Sync local state with the corrected (meets_threshold: true,
      // requires_override: false) response before navigating away — this
      // is what backend flagged: without it, any render between the click
      // and the route change would still show the pre-override result
      // (e.g. the old 0%/failed panel), since `result` was never updated.
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
          <h1 className="mb-2 text-lg font-bold text-foreground">
            Something went wrong
          </h1>
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

  if (stage === "done" && result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-lg p-8">
          <h1 className="text-xl font-bold text-foreground">
            Response submitted
          </h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            Your answer has been recorded and factored into your application.
          </p>

          {result.score != null ? (
            <div className="mb-6 flex items-center gap-5 rounded-xl border border-border bg-muted/40 p-5">
              <MatchScoreRing
                score={result.score}
                threshold={result.scenario_score_threshold}
                size="lg"
              />
              <div>
                <p
                  className={`text-sm font-semibold ${result.meets_threshold ? "text-success" : "text-warning"}`}
                >
                  {result.meets_threshold
                    ? "Meets the bar for this role"
                    : "Below this role's bar"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Needed {Math.round(result.scenario_score_threshold * 100)}% to
                  pass automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-warning-border bg-warning-bg p-5">
              <p className="text-sm text-warning-foreground">
                Your response was saved, but automatic scoring didn't complete.
                This won't block your application — it'll be reviewed
                separately.
              </p>
            </div>
          )}

          {result.requires_override && (
            <div className="mb-6 space-y-3 rounded-xl border border-warning-border bg-warning-bg p-5">
              <p className="text-sm text-warning-foreground">
                Your application hasn't been submitted yet — you can use one of
                your monthly overrides to submit it anyway.
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
                {result.overrides_remaining === 0
                  ? "No overrides remaining"
                  : "Use an override and submit anyway"}
              </Button>
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => router.push("/candidate/jobs")}
          >
            Back to job feed
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-6 py-3 backdrop-blur-sm">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Scenario question
          </span>
          {tabSwitchCount > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <AlertTriangle size={11} className="text-warning" />{" "}
              {tabSwitchCount} tab switch{tabSwitchCount !== 1 ? "es" : ""}{" "}
              logged
            </p>
          )}
        </div>
        <TimerRing secondsLeft={timeLeft} totalSeconds={totalTime} size={52} />
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <Card
          className={`mb-6 p-6 transition-colors ${urgent ? "border-danger-border" : ""}`}
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock3 size={13} />
            Answer this scenario in your own words — plain text only.
          </div>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
            {question?.question_text}
          </p>
        </Card>

        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onPaste={() => {
            pasteDetectedRef.current = true;
          }}
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
