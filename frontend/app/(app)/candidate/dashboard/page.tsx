"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Inbox,
  Send,
  Award,
  Hourglass,
  Repeat2,
  AlertTriangle,
  MessagesSquare,
  Search,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import JobDetailModal from "@/components/JobDetailModal";
import {
  Card,
  CardContent,
  SkeletonCard,
  SkeletonText,
  Button,
  Badge,
  Input,
  StatusBadge,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/utils";

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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
      toast({ title: "Override used", description: "Your application has moved forward.", variant: "success" });
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't use override", description: e.message, variant: "error" });
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
      toast({ title: "Application withdrawn", variant: "success" });
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't withdraw", description: e.message, variant: "error" });
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
    shortlisted: 4,
    assessment: 3,
    interview: 2,
    offer: 1,

    scenario_submitted: 5,
    withdrawn: 6,
    rejected: 999,
  };
  const sortedApplications = [...applications].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 1;
    const pb = STATUS_PRIORITY[b.status] ?? 1;
    return pa !== pb
      ? pa - pb
      : new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime();
  });

  const firstName = user?.full_name?.split(" ")[0];

  // Chips reflect whatever statuses actually show up, so the filter bar
  // never lists a status the candidate has zero applications in.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const app of applications)
      counts[app.status] = (counts[app.status] ?? 0) + 1;
    return counts;
  }, [applications]);
  const availableStatuses = Object.keys(statusCounts).sort((a, b) => {
    const pa = STATUS_PRIORITY[a] ?? 1;
    const pb = STATUS_PRIORITY[b] ?? 1;
    return pa - pb;
  });

  const filteredApplications = sortedApplications.filter((app) => {
    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !app.job_title.toLowerCase().includes(q) &&
        !app.org_name.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Hero — drifting ambient blobs + entrance animation instead of a   */}
      {/* static banner.                                                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative overflow-hidden border-b border-border px-6 py-8 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent"
        />
        <div
          aria-hidden
          className="animate-blob-drift pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-blob-drift pointer-events-none absolute -left-8 top-6 h-40 w-40 rounded-full bg-primary/5 blur-2xl"
          style={{ animationDuration: "14s", animationDelay: "-4s" }}
        />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-rise-in" style={{ animationDelay: "40ms" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Dashboard</p>
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
          <div className="animate-rise-in shrink-0" style={{ animationDelay: "100ms" }}>
            <Link href="/candidate/jobs">
              <Button rightIcon={<ArrowRight size={15} />}>Browse jobs</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-6">
        {/* ---------------------------------------------------------------- */}
        {/* Stat cards — quiet watermark-icon treatment, static (no hover),   */}
        {/* numbers count up on load, tinted borders, contextual subtext.     */}
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
                icon={Send}
                accent="primary"
                label="Applications"
                value={overview.total_applications}
                subtext="All submitted applications"
              />
              <StatCard
                icon={Award}
                accent="success"
                label="Shortlisted"
                value={overview.status_counts["shortlisted"] ?? 0}
                subtext="Moved into a pipeline"
              />
              <StatCard
                icon={Hourglass}
                accent="warning"
                label="In progress"
                value={inProgress}
                subtext="Awaiting your next step"
              />
              <StatCard
                icon={Repeat2}
                accent="primary"
                label="Overrides left"
                value={
                  overview.overrides_unlimited
                    ? "Unlimited"
                    : `${overview.overrides_remaining}/${overview.override_apps_limit}`
                }
                subtext="Resets monthly"
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
                <Inbox size={15} />
              </div>
              <p className="text-sm text-warning-foreground">
                You haven't uploaded a resume yet.{" "}
                <Link href="/candidate/resumes" className="font-medium underline underline-offset-2">
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
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Your applications
            </h2>
            {applications.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title or company…"
                  className="pl-8"
                />
              </div>
            )}
          </div>

          {/* Filter chips sit directly under the search row now (tighter
              gap, same visual block) instead of floating as a separate
              section with a large gap beneath it. */}
          {applications.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                All ({applications.length})
              </FilterChip>
              {availableStatuses.map((s) => (
                <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                  {s.replace(/_/g, " ")} ({statusCounts[s]})
                </FilterChip>
              ))}
            </div>
          )}

          {loading && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="p-4">
                <SkeletonText lines={2} />
              </Card>
              <Card className="p-4">
                <SkeletonText lines={2} />
              </Card>
              <Card className="p-4">
                <SkeletonText lines={2} />
              </Card>
            </div>
          )}

          {!loading && applications.length === 0 && (
            <Card className="border-dashed p-10 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Inbox size={19} />
              </div>
              <p className="mb-3 text-sm text-muted-foreground">You haven't applied to any jobs yet.</p>
              <Link
                href="/candidate/jobs"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
              >
                Browse the job feed <ArrowRight size={13} />
              </Link>
            </Card>
          )}

          {!loading && applications.length > 0 && filteredApplications.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No applications match your filters.</p>
          )}

          {/* 3-col from lg (not xl) — at typical desktop widths two cards
              were leaving a large empty void on the right. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredApplications.map((app) => {
              const needsAction = app.status === "scenario_pending" && app.scenario_meets_threshold === false;
              const inPipeline = ["shortlisted", "assessment", "interview", "offer"].includes(app.status);

              return (
                <Card key={app.id} interactive onClick={() => setSelectedJobId(app.job_id)} className="group p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {/* line-clamp instead of truncate — titles that fit on
                          two lines no longer cut off early with room to spare. */}
                      <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground">
                        {app.job_title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{app.org_name}</p>
                    </div>
                    <StatusBadge status={app.status} className="shrink-0" />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <p className="text-xs text-muted-foreground">{formatAppliedDate(app.applied_at)}</p>
                    {app.is_override && (
                      <Badge variant="warning" className="py-0 text-[10px]">
                        Override used
                      </Badge>
                    )}
                  </div>

                  {inPipeline && (
                    <Link
                      href={`/candidate/pipeline/${app.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
                    >
                      <MessagesSquare size={12} />
                      Pipeline messages
                    </Link>
                  )}

                  {needsAction && (
                    <div
                      className="mt-3 flex flex-col gap-2 rounded-lg border border-warning-border bg-warning-bg p-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="flex items-center gap-1.5 text-xs font-medium text-warning-foreground">
                        <AlertTriangle size={12} className="shrink-0" />
                        Below the scenario bar
                      </p>
                      {overview && overview.overrides_remaining > 0 ? (
                        <Button size="sm" variant="secondary" loading={busyId === app.id} onClick={() => useOverride(app.id)}>
                          Use override
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" loading={busyId === app.id} onClick={() => withdraw(app.id)}>
                          Withdraw
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Explicit click affordance — cards previously looked like
                      static display blocks with no visual cue they're
                      interactive beyond the hover border. */}
                  {!needsAction && (
                    <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-medium text-muted-foreground/70 transition-colors group-hover:text-primary">
                      View status <ChevronRight size={12} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {selectedJobId && (
        <JobDetailModal jobId={selectedJobId} application={selectedApplication as any} onClose={() => setSelectedJobId(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Count-up: writes directly to the span's textContent via ref each frame,
// same 60fps-friendly pattern used elsewhere (no per-frame re-render).
// ---------------------------------------------------------------------------

function useCountUp(value: number, duration = 700) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prevRef.current;
    const to = value;
    if (from === to) {
      el.textContent = String(to);
      return;
    }
    const start = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  return ref;
}

// ---------------------------------------------------------------------------
// Stat card — quiet, static (no hover — these aren't clickable), label+icon
// on top, big number below, a subtle tinted border matching the accent, an
// optional contextual subtext line, and a much fainter watermark icon so it
// no longer competes with the real icon/label.
// ---------------------------------------------------------------------------

type Accent = "primary" | "success" | "warning";

const ACCENT_BG: Record<Accent, string> = {
  primary: "bg-primary/5",
  success: "bg-success-bg",
  warning: "bg-warning-bg",
};
const ACCENT_TEXT: Record<Accent, string> = {
  primary: "text-primary",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
};
// Tinted borders — success/warning already have dedicated border tokens;
// primary doesn't, so it's approximated with the accent at low opacity.
const ACCENT_BORDER: Record<Accent, string> = {
  primary: "border-primary/15",
  success: "border-success-border",
  warning: "border-warning-border",
};

function StatCard({
  icon: Icon,
  accent,
  label,
  value,
  subtext,
}: {
  icon: React.ElementType;
  accent: Accent;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  const numeric = typeof value === "number";
  const countRef = useCountUp(numeric ? value : 0);

  return (
    <Card className={cn("relative overflow-hidden p-3.5", ACCENT_BG[accent], ACCENT_BORDER[accent])}>
      <Icon size={56} className={cn("pointer-events-none absolute -right-3 -top-3 opacity-[0.04]", ACCENT_TEXT[accent])} />
      <CardContent className="relative space-y-1.5 p-0">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={ACCENT_TEXT[accent]} />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {numeric ? <span ref={countRef}>0</span> : value}
        </p>
        {subtext && <p className="text-[11px] text-muted-foreground/80">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}