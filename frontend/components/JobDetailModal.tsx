"use client";

import { useEffect, useState } from "react";
import { MapPin, Briefcase } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  SlideOver,
  Button,
  Badge,
  Skeleton,
  SkeletonText,
} from "@/components/ui";
import { useRouter } from "next/navigation";

interface JobDetail {
  id: string;
  title: string;
  description: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  categories?: string[] | null;
  scenario_enabled: boolean;
  scenario_score_threshold: number;
  org_name: string;
  org_domain: string | null;
  org_verification_status: string;
}

interface ResumeVersion {
  id: string;
  version_number: number;
  label: string | null;
  is_current: boolean;
}

interface ApplicationSummary {
  id: string;
  job_id: string;
  status: string;
  match_score: number | null;
  is_override: boolean;
  scenario_enabled: boolean;
  scenario_score: number | null;
  scenario_ai_summary: string | null;
  scenario_meets_threshold: boolean | null;
}

interface RelevanceResult {
  resume_version_id: string;
  match_score: number | null;
  match_threshold: number;
  meets_threshold: boolean;
}

interface Props {
  jobId: string;
  resumeVersions: ResumeVersion[];
  application?: ApplicationSummary;
  onClose: () => void;
  onApplied: (application: {
    id: string;
    job_id: string;
    status: string;
  }) => void;
  onWithdrawn?: (jobId: string) => void;
}

export default function JobDetailModal({
  jobId,
  resumeVersions,
  application,
  onClose,
  onApplied,
  onWithdrawn,
}: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedResumeId, setSelectedResumeId] = useState(
    resumeVersions.find((r) => r.is_current)?.id ?? resumeVersions[0]?.id ?? "",
  );
  const [relevance, setRelevance] = useState<RelevanceResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [overridesRemaining, setOverridesRemaining] = useState<number | null>(
    null,
  );
  const [showScenarioConfirm, setShowScenarioConfirm] = useState(false);

  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/jobs/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Failed to load job");
        setDetail(data);
      } catch (e: any) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const checkRelevance = async () => {
    if (!selectedResumeId) return;
    setChecking(true);
    setRelevance(null);
    setApplyError(null);
    try {
      const res = await apiFetch(
        `/jobs/${jobId}/relevance?resume_version_id=${selectedResumeId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to check relevance");
      setRelevance(data);
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const submitApply = async (override: boolean) => {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await apiFetch("/applications/", {
        method: "POST",
        body: JSON.stringify({
          job_id: jobId,
          resume_version_id: selectedResumeId,
          override,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.detail?.code === "low_match") {
          setOverridesRemaining(data.detail.overrides_remaining ?? null);
          setApplyError(data.detail.message);
          return;
        }
        throw new Error(
          data.detail?.message ?? data.detail ?? "Failed to apply",
        );
      }

      const newStatus = data.status ?? "pending";

      // Scenario-gated jobs: go straight into the timed test instead of
      // dropping the candidate back on the feed, where they'd have to
      // reopen this same job and click through again to start it.
      if (newStatus === "scenario_pending") {
        router.push(`/candidate/scenario/${data.id}`);
        return;
      }

      onApplied({
        id: data.id,
        job_id: jobId,
        status: newStatus,
      });
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!application) return;
    if (!confirm("Withdraw this application? This can't be undone.")) return;
    setWithdrawing(true);
    try {
      const res = await apiFetch(`/applications/${application.id}/withdraw`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to withdraw");
      }
      onWithdrawn?.(jobId);
      onClose();
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <SlideOver
      open
      onClose={onClose}
      title={loading ? "Loading…" : detail?.title}
      width="lg"
    >
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-4 w-1/3" />
          <SkeletonText lines={4} />
        </div>
      )}
      {loadError && <p className="text-sm text-danger">{loadError}</p>}

      {detail && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{detail.org_name}</span>
              <Badge
                variant={
                  detail.org_verification_status === "verified"
                    ? "success"
                    : "warning"
                }
              >
                {detail.org_verification_status}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {detail.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} />
                  {detail.location}
                </span>
              )}
              {detail.work_mode && (
                <span className="capitalize flex items-center gap-1.5">
                  <Briefcase size={13} />
                  {detail.work_mode}
                </span>
              )}
              {detail.job_level && (
                <span className="capitalize">{detail.job_level} level</span>
              )}
            </div>
            {(detail.salary_min || detail.salary_max) && (
              <p className="mt-2 text-sm font-medium text-foreground">
                {detail.salary_min && detail.salary_max
                  ? `₹${detail.salary_min.toLocaleString()} – ₹${detail.salary_max.toLocaleString()}`
                  : detail.salary_min
                    ? `From ₹${detail.salary_min.toLocaleString()}`
                    : `Up to ₹${detail.salary_max!.toLocaleString()}`}
              </p>
            )}
            {detail.categories && detail.categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {detail.categories.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary"
                  >
                    {c.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {detail.description}
            </p>
          </div>

          {detail.scenario_enabled && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Includes a scenario question
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                After you apply, you'll be asked a role-specific scenario
                question with a time limit. You'll need to score at least{" "}
                {Math.round(detail.scenario_score_threshold * 100)}% to pass —
                if you don't, you can use a monthly override to submit anyway.
                It's generated when you apply, so there's nothing to preview
                beforehand.
              </p>
            </div>
          )}

          {application ? (
            <div className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-success-foreground">
                  You've applied to this job.
                </p>
                <Badge>{application.status.replace(/_/g, " ")}</Badge>
              </div>

              {application.match_score != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Resume match</span>
                  <span className="font-medium text-foreground">
                    {Math.round(application.match_score * 100)}%
                  </span>
                </div>
              )}

              {detail.scenario_enabled &&
                application.scenario_score != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Scenario score
                    </span>
                    <span
                      className={`font-medium ${application.scenario_meets_threshold === false ? "text-warning" : "text-foreground"}`}
                    >
                      {Math.round(application.scenario_score * 100)}%
                      {application.scenario_meets_threshold === false &&
                        " (below bar)"}
                    </span>
                  </div>
                )}

              {application.is_override && (
                <p className="text-xs text-warning">
                  You used a monthly override on this application.
                </p>
              )}

              {application.status === "scenario_pending" && (
                <a
                  href={
                    application.scenario_score != null
                      ? "/candidate/dashboard"
                      : `/candidate/scenario/${application.id}`
                  }
                  className="block rounded-lg bg-primary py-2 text-center text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {application.scenario_score != null
                    ? "Manage on dashboard"
                    : "Continue to scenario test"}
                </a>
              )}

              {!["withdrawn", "rejected"].includes(application.status) && (
                <Button
                  variant="outline"
                  className="w-full"
                  loading={withdrawing}
                  onClick={handleWithdraw}
                >
                  Withdraw application
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 border-t border-border pt-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resume to use
                </label>
                <select
                  value={selectedResumeId}
                  onChange={(e) => {
                    setSelectedResumeId(e.target.value);
                    setRelevance(null);
                  }}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {resumeVersions.map((rv) => (
                    <option key={rv.id} value={rv.id}>
                      {rv.label ?? `Version ${rv.version_number}`}
                      {rv.is_current ? " (active)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!relevance && (
                <Button
                  className="w-full"
                  loading={checking}
                  disabled={!selectedResumeId}
                  onClick={checkRelevance}
                >
                  Check relevance
                </Button>
              )}

              {relevance && (
                <div
                  className={`rounded-lg border p-4 ${relevance.meets_threshold ? "border-success-border bg-success-bg" : "border-warning-border bg-warning-bg"}`}
                >
                  <p
                    className={`text-sm font-medium ${relevance.meets_threshold ? "text-success-foreground" : "text-warning-foreground"}`}
                  >
                    {relevance.match_score != null
                      ? `${Math.round(relevance.match_score * 100)}% match`
                      : "Match score not available yet"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {relevance.meets_threshold
                      ? "This looks like a strong match for your profile."
                      : "Your profile is not a strong match for this role based on your skills and experience."}
                  </p>
                </div>
              )}

              {applyError && (
                <p className="text-sm text-danger">{applyError}</p>
              )}

              {relevance && detail.scenario_enabled && showScenarioConfirm && (
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-foreground">
                    This job requires a scenario-based test. Once you confirm,
                    you'll be taken straight to it and the timer starts
                    immediately — make sure you're ready before continuing.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      loading={applying}
                      onClick={() => submitApply(!relevance.meets_threshold)}
                    >
                      Yes, start the test
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={applying}
                      onClick={() => setShowScenarioConfirm(false)}
                    >
                      Not yet
                    </Button>
                  </div>
                </div>
              )}

              {relevance &&
                (!detail.scenario_enabled || !showScenarioConfirm) && (
                  <Button
                    className="w-full"
                    variant={
                      relevance.meets_threshold ? "primary" : "secondary"
                    }
                    loading={applying}
                    onClick={() =>
                      detail.scenario_enabled
                        ? setShowScenarioConfirm(true)
                        : submitApply(!relevance.meets_threshold)
                    }
                  >
                    {relevance.meets_threshold
                      ? "Apply"
                      : `Apply anyway${overridesRemaining != null ? ` (${overridesRemaining} left)` : ""}`}
                  </Button>
                )}
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}
