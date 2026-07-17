"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonCard, SkeletonText } from "@/components/ui/Skeleton";

interface Overview {
  has_resume: boolean;
  resume_categories: string[] | null;
  subscription_tier: string;
  override_apps_used: number;
  override_apps_limit: number;
  overrides_remaining: number;
  total_applications: number;
  status_counts: Record<string, number>;
  overrides_unlimited: boolean;
}

interface ApplicationRow {
  id: string;
  job_id: string;
  status: string;
  match_score: number | null;
  is_override: boolean;
  applied_at: string;
  job_title: string;
  org_name: string;
  scenario_enabled: boolean;
  scenario_score: number | null;
  scenario_ai_summary: string | null;
  scenario_meets_threshold: boolean | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  resume_rejected: "Below match bar",
  resume_passed: "Resume passed",
  scenario_pending: "Scenario in progress",
  scenario_submitted: "Scenario submitted",
  shortlisted: "Shortlisted",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "primary"
> = {
  pending: "default",
  resume_rejected: "danger",
  resume_passed: "primary",
  scenario_pending: "warning",
  scenario_submitted: "primary",
  shortlisted: "success",
  assessment: "primary",
  interview: "primary",
  offer: "success",
  rejected: "danger",
  withdrawn: "default",
};

export default function CandidateDashboardPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <DashboardContent />
    </RoleGuard>
  );
}

function DashboardContent() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, appsRes] = await Promise.all([
        apiFetch("/candidates/me/overview"),
        apiFetch("/applications/mine"),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (appsRes.ok) {
        const data = await appsRes.json();
        setApplications(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const useOverride = async (applicationId: string) => {
    setBusyId(applicationId);
    try {
      const res = await apiFetch(
        `/applications/${applicationId}/scenario/override`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to apply override");
      }
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (applicationId: string) => {
    if (!confirm("Withdraw this application? This can't be undone.")) return;
    setBusyId(applicationId);
    try {
      const res = await apiFetch(`/applications/${applicationId}/withdraw`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to withdraw");
      }
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <Link
          href="/candidate/jobs"
          className="text-sm text-primary hover:text-primary-hover"
        >
          Browse jobs →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        overview && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Applications"
              value={overview.total_applications}
            />
            <StatCard
              label="Shortlisted"
              value={overview.status_counts["shortlisted"] ?? 0}
            />
            <StatCard
              label="In progress"
              value={
                (overview.status_counts["scenario_pending"] ?? 0) +
                (overview.status_counts["resume_passed"] ?? 0) +
                (overview.status_counts["scenario_submitted"] ?? 0)
              }
            />
            <StatCard
              label="Overrides left"
              value={
                overview.overrides_unlimited
                  ? "Unlimited"
                  : `${overview.overrides_remaining}/${overview.override_apps_limit}`
              }
            />
          </div>
        )
      )}

      {!loading && overview && !overview.has_resume && (
        <div className="bg-warning-bg border border-warning-border text-warning-foreground px-4 py-3 rounded-lg text-sm">
          You haven't uploaded a resume yet.{" "}
          <Link href="/candidate/resumes" className="underline font-medium">
            Upload one
          </Link>{" "}
          to start applying.
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Your applications
        </h2>

        {loading && (
          <Card className="p-5">
            <SkeletonText lines={3} />
          </Card>
        )}

        {!loading && applications.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm mb-3">
              You haven't applied to any jobs yet.
            </p>
            <Link
              href="/candidate/jobs"
              className="text-sm text-primary hover:text-primary-hover font-medium"
            >
              Browse the job feed →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id} className="p-4 flex flex-col gap-2">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="font-medium text-foreground">{app.job_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {app.org_name}
                  </p>
                </div>
                <Badge
                  variant={STATUS_VARIANT[app.status] ?? "default"}
                  className="shrink-0"
                >
                  {STATUS_LABELS[app.status] ?? app.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {app.match_score != null && (
                  <span>
                    Resume match: {Math.round(app.match_score * 100)}%
                  </span>
                )}
                {app.scenario_enabled && app.scenario_score != null && (
                  <span>
                    Scenario score: {Math.round(app.scenario_score * 100)}%
                    {app.scenario_meets_threshold === false && " (below bar)"}
                  </span>
                )}
                {app.is_override && (
                  <span className="text-warning">Used override</span>
                )}
                <span>
                  Applied {new Date(app.applied_at).toLocaleDateString()}
                </span>
              </div>

              {app.scenario_ai_summary && (
                <p className="text-xs text-muted-foreground mt-1">
                  {app.scenario_ai_summary}
                </p>
              )}

              {["shortlisted", "assessment", "interview", "offer"].includes(
                app.status,
              ) && (
                <Link
                  href={`/candidate/pipeline/${app.id}`}
                  className="text-xs text-primary hover:text-primary-hover mt-1"
                >
                  View pipeline messages →
                </Link>
              )}

              {app.status === "scenario_pending" &&
                app.scenario_meets_threshold === false && (
                  <div className="flex gap-2 mt-2">
                    {overview && overview.overrides_remaining > 0 ? (
                      <button
                        onClick={() => useOverride(app.id)}
                        disabled={busyId === app.id}
                        className="text-xs bg-warning text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:brightness-110 transition-all"
                      >
                        {busyId === app.id
                          ? "Submitting…"
                          : "Use override & submit"}
                      </button>
                    ) : (
                      <button
                        onClick={() => withdraw(app.id)}
                        disabled={busyId === app.id}
                        className="text-xs bg-muted hover:bg-border text-foreground px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        Withdraw application
                      </button>
                    )}
                  </div>
                )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
