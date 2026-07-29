"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Inbox,
  Briefcase,
  Clock3,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Upload,
  AlertTriangle,
  MessagesSquare,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import JobDetailModal from "@/components/JobDetailModal";
import {
  Card,
  CardContent,
  PageHeader,
  SkeletonCard,
  SkeletonText,
  MatchScoreRing,
  Button,
  StatusBadge,
  useToast,
} from "@/components/ui";

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

// Leading-icon treatment for applications with no computable match score yet
// (embeddings pending) — status-aware so the row still communicates something
// at a glance instead of a bare dash.
const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Clock3,
  resume_rejected: XCircle,
  resume_passed: CheckCircle2,
  scenario_pending: Clock3,
  scenario_submitted: CheckCircle2,
  shortlisted: CheckCircle2,
  assessment: CheckCircle2,
  interview: CheckCircle2,
  offer: Sparkles,
  rejected: XCircle,
  withdrawn: RotateCcw,
};

const STATUS_ICON_STYLE: Record<string, string> = {
  pending: "text-muted-foreground border-border",
  resume_rejected: "text-danger border-danger-border",
  resume_passed: "text-primary border-primary/30",
  scenario_pending: "text-warning border-warning-border",
  scenario_submitted: "text-primary border-primary/30",
  shortlisted: "text-success border-success-border",
  assessment: "text-primary border-primary/30",
  interview: "text-primary border-primary/30",
  offer: "text-success border-success-border",
  rejected: "text-danger border-danger-border",
  withdrawn: "text-muted-foreground border-border",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatAppliedDate(iso: string) {
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Applied today";
  if (diffDays === 1) return "Applied yesterday";
  if (diffDays < 7) return `Applied ${diffDays}d ago`;
  return `Applied ${date.toLocaleDateString()}`;
}

export default function CandidateDashboardPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <DashboardContent />
    </RoleGuard>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [resumeVersions, setResumeVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, appsRes, resumeVersionsRes] = await Promise.all([
        apiFetch("/candidates/me/overview"),
        apiFetch("/applications/mine"),
        apiFetch("/resumes"),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (appsRes.ok) {
        const data = await appsRes.json();
        setApplications(Array.isArray(data) ? data : []);
      }
      if (resumeVersionsRes.ok) {
        const data = await resumeVersionsRes.json();
        setResumeVersions(Array.isArray(data) ? data : []);
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
        { method: "POST" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to apply override");
      }
      toast({
        title: "Override used",
        description: "Your application has moved forward.",
        variant: "success",
      });
      await load();
    } catch (e: any) {
      toast({
        title: "Couldn't use override",
        description: e.message,
        variant: "error",
      });
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
      toast({ title: "Application withdrawn", variant: "success" });
      await load();
    } catch (e: any) {
      toast({
        title: "Couldn't withdraw",
        description: e.message,
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const inProgress =
    (overview?.status_counts["scenario_pending"] ?? 0) +
    (overview?.status_counts["resume_passed"] ?? 0) +
    (overview?.status_counts["scenario_submitted"] ?? 0);
  const selectedApplication = applications.find(
    (a) => a.job_id === selectedJobId && a.status !== "withdrawn",
  );

  const STATUS_PRIORITY: Record<string, number> = {
    shortlisted: 0,
    assessment: 0,
    interview: 0,
    offer: 0,
  };
  const sortedApplications = [...applications].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 1;
    const pb = STATUS_PRIORITY[b.status] ?? 1;
    return pa !== pb
      ? pa - pb
      : new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime();
  });

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — mirrors the profile page's banner treatment so the app    */}
      {/* feels like one continuous product rather than a bare page title. */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative overflow-hidden border-b border-border px-6 py-8 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Dashboard
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {getGreeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {overview
                ? `${overview.total_applications} application${overview.total_applications !== 1 ? "s" : ""} tracked`
                : "Loading your applications…"}
            </p>
          </div>
          <Link href="/candidate/jobs" className="shrink-0">
            <Button rightIcon={<ArrowRight size={15} />}>Browse jobs</Button>
          </Link>
        </div>
      </div>

      <div className="space-y-8 p-6">
        {/* ---------------------------------------------------------------- */}
        {/* Stat cards                                                       */}
        {/* ---------------------------------------------------------------- */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          overview && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                icon={Briefcase}
                accent="primary"
                label="Applications"
                value={overview.total_applications}
                delay={0}
              />
              <StatCard
                icon={CheckCircle2}
                accent="success"
                label="Shortlisted"
                value={overview.status_counts["shortlisted"] ?? 0}
                delay={40}
              />
              <StatCard
                icon={Clock3}
                accent="warning"
                label="In progress"
                value={inProgress}
                delay={80}
              />
              <StatCard
                icon={RotateCcw}
                accent="primary"
                label="Overrides left"
                value={
                  overview.overrides_unlimited
                    ? "Unlimited"
                    : `${overview.overrides_remaining}/${overview.override_apps_limit}`
                }
                delay={120}
              />
            </div>
          )
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Resume nudge                                                     */}
        {/* ---------------------------------------------------------------- */}
        {!loading && overview && !overview.has_resume && (
          <Card className="border-warning-border bg-warning-bg p-4">
            <CardContent className="flex items-center gap-3 p-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                <Upload size={15} />
              </div>
              <p className="text-sm text-warning-foreground">
                You haven't uploaded a resume yet.{" "}
                <Link
                  href="/candidate/resumes"
                  className="font-medium underline underline-offset-2"
                >
                  Upload one
                </Link>{" "}
                to start applying.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Applications                                                     */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Your applications
            </h2>
            {applications.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Click any card for the full listing
              </span>
            )}
          </div>

          {loading && (
            <div className="space-y-3">
              <Card className="p-5">
                <SkeletonText lines={3} />
              </Card>
              <Card className="p-5">
                <SkeletonText lines={3} />
              </Card>
            </div>
          )}

          {!loading && applications.length === 0 && (
            <Card className="border-dashed p-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Inbox size={19} />
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                You haven't applied to any jobs yet.
              </p>
              <Link
                href="/candidate/jobs"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
              >
                Browse the job feed <ArrowRight size={13} />
              </Link>
            </Card>
          )}

          <div className="space-y-2.5">
            {sortedApplications.map((app, i) => {
              const needsAction =
                app.status === "scenario_pending" &&
                app.scenario_meets_threshold === false;
              const StatusIcon = STATUS_ICON[app.status] ?? Clock3;
              const iconStyle =
                STATUS_ICON_STYLE[app.status] ??
                "text-muted-foreground border-border";
              const inPipeline = [
                "shortlisted",
                "assessment",
                "interview",
                "offer",
              ].includes(app.status);

              return (
                <Card
                  key={app.id}
                  interactive
                  onClick={() => setSelectedJobId(app.job_id)}
                  className="animate-rise-in p-4"
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                >
                  <div className="flex items-center gap-4">
                    {app.match_score != null ? (
                      <MatchScoreRing score={app.match_score} size="sm" />
                    ) : (
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${iconStyle}`}
                      >
                        <StatusIcon size={15} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {app.job_title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {app.org_name} · {formatAppliedDate(app.applied_at)}
                        {app.is_override && (
                          <span className="text-warning"> · override used</span>
                        )}
                      </p>
                    </div>

                    <StatusBadge status={app.status} className="shrink-0" />
                  </div>

                  {inPipeline && (
                    <Link
                      href={`/candidate/pipeline/${app.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
                    >
                      <MessagesSquare size={12} />
                      View pipeline messages
                    </Link>
                  )}

                  {needsAction && (
                    <div
                      className="mt-3 flex flex-col gap-3 rounded-lg border border-warning-border bg-warning-bg p-3 sm:flex-row sm:items-center sm:justify-between"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="flex items-center gap-1.5 text-xs font-medium text-warning-foreground">
                        <AlertTriangle size={13} className="shrink-0" />
                        Below the scenario bar for this role
                      </p>
                      {overview && overview.overrides_remaining > 0 ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === app.id}
                          onClick={() => useOverride(app.id)}
                        >
                          Use override & submit
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyId === app.id}
                          onClick={() => withdraw(app.id)}
                        >
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
          resumeVersions={resumeVersions}
          application={selectedApplication as any}
          onClose={() => setSelectedJobId(null)}
          onApplied={() => setSelectedJobId(null)}
          onWithdrawn={() => load()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card — icon in a tinted circle, subtle hover lift + icon scale.
// ---------------------------------------------------------------------------

const ACCENT_STYLES: Record<"primary" | "success" | "warning", string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-bg text-success-foreground",
  warning: "bg-warning-bg text-warning-foreground",
};

function StatCard({
  icon: Icon,
  accent,
  label,
  value,
  delay = 0,
}: {
  icon: React.ElementType;
  accent: "primary" | "success" | "warning";
  label: string;
  value: string | number;
  delay?: number;
}) {
  return (
    <Card
      className="group animate-rise-in p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-0">
        <div
          className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${ACCENT_STYLES[accent]}`}
        >
          <Icon size={16} />
        </div>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
