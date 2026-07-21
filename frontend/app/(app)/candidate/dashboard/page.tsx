"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import JobDetailModal from "@/components/JobDetailModal";
import { Card, CardContent, Badge, PageHeader, SkeletonCard, SkeletonText, MatchScoreRing, Button } from "@/components/ui";

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

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "primary"> = {
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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

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
      const res = await apiFetch(`/applications/${applicationId}/scenario/override`, { method: "POST" });
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
      const res = await apiFetch(`/applications/${applicationId}/withdraw`, { method: "POST" });
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

  const inProgress =
    (overview?.status_counts["scenario_pending"] ?? 0) +
    (overview?.status_counts["resume_passed"] ?? 0) +
    (overview?.status_counts["scenario_submitted"] ?? 0);

  const selectedApplication = applications.find((a) => a.job_id === selectedJobId);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Dashboard"
        description={overview ? `${overview.total_applications} application${overview.total_applications !== 1 ? "s" : ""} tracked` : undefined}
        actions={
          <Link href="/candidate/jobs">
            <Button size="sm" rightIcon={<ArrowRight size={14} />}>Browse jobs</Button>
          </Link>
        }
      />

      <div className="space-y-8 p-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          overview && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Applications" value={overview.total_applications} />
              <StatCard label="Shortlisted" value={overview.status_counts["shortlisted"] ?? 0} />
              <StatCard label="In progress" value={inProgress} />
              <StatCard
                label="Overrides left"
                value={overview.overrides_unlimited ? "Unlimited" : `${overview.overrides_remaining}/${overview.override_apps_limit}`}
              />
            </div>
          )
        )}

        {!loading && overview && !overview.has_resume && (
          <Card className="border-warning-border bg-warning-bg p-4">
            <p className="text-sm text-warning-foreground">
              You haven't uploaded a resume yet.{" "}
              <Link href="/candidate/resumes" className="font-medium underline">Upload one</Link> to start applying.
            </p>
          </Card>
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your applications</h2>
          <p className="mb-3 -mt-2 text-xs text-muted-foreground">Click any application to view the full job description.</p>

          {loading && (
            <Card className="p-5">
              <SkeletonText lines={3} />
            </Card>
          )}

          {!loading && applications.length === 0 && (
            <Card className="p-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Inbox size={18} />
              </div>
              <p className="mb-3 text-sm text-muted-foreground">You haven't applied to any jobs yet.</p>
              <Link href="/candidate/jobs" className="text-sm font-medium text-primary hover:text-primary-hover">
                Browse the job feed →
              </Link>
            </Card>
          )}

          <div className="space-y-2.5">
            {applications.map((app) => {
              const needsAction = app.status === "scenario_pending" && app.scenario_meets_threshold === false;
              return (
                <Card
                  key={app.id}
                  interactive
                  onClick={() => setSelectedJobId(app.job_id)}
                  className="p-4"
                >
                  <div className="flex items-center gap-4">
                    {app.match_score != null ? (
                      <MatchScoreRing score={app.match_score} size="sm" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
                        —
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{app.job_title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {app.org_name} · Applied {new Date(app.applied_at).toLocaleDateString()}
                        {app.is_override && <span className="text-warning"> · override used</span>}
                      </p>
                    </div>

                    <Badge variant={STATUS_VARIANT[app.status] ?? "default"} className="shrink-0">
                      {STATUS_LABELS[app.status] ?? app.status}
                    </Badge>
                  </div>

                  {["shortlisted", "assessment", "interview", "offer"].includes(app.status) && (
                    <Link
                      href={`/candidate/pipeline/${app.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-block text-xs text-primary hover:text-primary-hover"
                    >
                      View pipeline messages →
                    </Link>
                  )}

                  {needsAction && (
                    <div className="mt-3 flex gap-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                      {overview && overview.overrides_remaining > 0 ? (
                        <Button size="sm" variant="secondary" loading={busyId === app.id} onClick={() => useOverride(app.id)}>
                          Use override & submit
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" loading={busyId === app.id} onClick={() => withdraw(app.id)}>
                          Withdraw application
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {selectedJobId && (
        <JobDetailModal
          jobId={selectedJobId}
          resumeVersions={[]}
          application={selectedApplication as any}
          onClose={() => setSelectedJobId(null)}
          onApplied={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}