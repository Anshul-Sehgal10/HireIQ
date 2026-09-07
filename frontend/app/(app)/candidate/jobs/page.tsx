"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Gauge,
  History,
  Search,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RoleGuard } from "@/components/RoleGuard";
import JobDetailModal from "@/components/JobDetailModal";
import JobCard from "@/components/JobCard";
import ResumeUpload from "@/components/ResumeUpload";
import {
  Card,
  SkeletonCard,
  Button,
  Input,
  SlideOver,
  StatusBadge,
  useToast,
} from "@/components/ui";

const ALL_CATEGORIES = [
  "backend",
  "frontend",
  "fullstack",
  "mobile",
  "devops_cloud",
  "data_ml",
  "qa_testing",
  "security",
  "design_ux",
  "product_management",
  "embedded_systems",
  "game_dev",
  "blockchain",
  "sales",
  "marketing",
  "hr_recruiting",
  "finance",
  "operations",
  "customer_support",
  "other",
];

const JOB_TYPES: { value: string; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];
const JOB_TYPE_LABELS: Record<string, string> = Object.fromEntries(JOB_TYPES.map((t) => [t.value, t.label]));

interface Job {
  id: string;
  org_id: string;
  title: string;
  description: string;
  status: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  job_type: string | null;
  hiring_count: number;
  salary_min: number | null;
  salary_max: number | null;
  org_name: string | null;
  logo_url: string | null;
  categories: string[] | null;
  scenario_enabled: boolean;
  role_summary: string | null;
  created_at?: string | null;
}

interface Application {
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

interface ResumeVersion {
  id: string;
  version_number: number;
  label: string | null;
  s3_key: string;
  created_at: string;
  is_current: boolean;
}

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

interface JobFeedResponse {
  jobs: Job[];
  next_cursor: string | null;
  has_more: boolean;
}

interface Filters {
  q: string;
  categories: string[];
  location: string;
  salary_min: string;
  salary_max: string;
  job_type: string[];
}

const EMPTY_FILTERS: Filters = {
  q: "",
  categories: [],
  location: "",
  salary_min: "",
  salary_max: "",
  job_type: [],
};

const SALARY_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: "Any" },
  { label: "Up to ₹5L", max: 500000 },
  { label: "₹5L – 10L", min: 500000, max: 1000000 },
  { label: "₹10L – 15L", min: 1000000, max: 1500000 },
  { label: "₹15L – 25L", min: 1500000, max: 2500000 },
  { label: "₹25L – 40L", min: 2500000, max: 4000000 },
  { label: "₹40L+", min: 4000000 },
];

function findActiveSalaryBand(filters: Filters) {
  return (
    SALARY_BANDS.find(
      (b) => (b.min?.toString() ?? "") === filters.salary_min && (b.max?.toString() ?? "") === filters.salary_max,
    ) ?? SALARY_BANDS[0]
  );
}

export default function CandidateJobsPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <JobFeed />
    </RoleGuard>
  );
}

// ---------------------------------------------------------------------------
// Filter drawer content — no Card/header/close button of its own; it lives
// inside a SlideOver in the parent, which already provides those.
// ---------------------------------------------------------------------------

function FilterPanelContent({
  filters,
  onChange,
  onReset,
  categoriesAreDefault,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  categoriesAreDefault: boolean;
}) {
  const [catQuery, setCatQuery] = useState("");
  const [locDraft, setLocDraft] = useState(filters.location);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLocDraft(filters.location), [filters.location]);

  const commitLocation = (val: string) => {
    setLocDraft(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange({ ...filters, location: val }), 400);
  };

  const activeBand = findActiveSalaryBand(filters);

  const selectBand = (band: (typeof SALARY_BANDS)[number]) => {
    onChange({
      ...filters,
      salary_min: band.min?.toString() ?? "",
      salary_max: band.max?.toString() ?? "",
    });
  };

  const toggleJobType = (value: string) => {
    const next = filters.job_type.includes(value)
      ? filters.job_type.filter((t) => t !== value)
      : [...filters.job_type, value];
    onChange({ ...filters, job_type: next });
  };

  const filteredCategories = ALL_CATEGORIES.filter((c) => c.toLowerCase().includes(catQuery.toLowerCase()));

  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job type</p>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPES.map((jt) => {
            const active = filters.job_type.includes(jt.value);
            return (
              <button
                key={jt.value}
                onClick={() => toggleJobType(jt.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {jt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
        <Input placeholder="City or remote" value={locDraft} onChange={(e) => commitLocation(e.target.value)} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salary range</p>
        <div className="scrollbar-none flex flex-wrap gap-2">
          {SALARY_BANDS.map((band) => {
            const active = band.label === activeBand.label;
            return (
              <button
                key={band.label}
                onClick={() => selectBand(band)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
          <div className="flex items-center gap-3">
            {!categoriesAreDefault && (
              <button onClick={onReset} className="text-xs font-medium text-primary hover:text-primary-hover">
                Reset to profile
              </button>
            )}
            {filters.categories.length > 0 && (
              <button
                onClick={() => onChange({ ...filters, categories: [] })}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <Input
          placeholder="Search categories…"
          value={catQuery}
          onChange={(e) => setCatQuery(e.target.value)}
          className="mb-2.5"
        />

        <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {filteredCategories.length === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground">No categories match &quot;{catQuery}&quot;</p>
            )}
            {filteredCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  filters.categories.includes(cat)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {cat.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground">
      {children}
      <button onClick={onRemove} aria-label="Remove filter" className="text-muted-foreground transition-colors hover:text-foreground">
        <X size={11} />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sidebar widgets — real data only (no fabricated "job alerts" feature
// without a backend behind it).
// ---------------------------------------------------------------------------

// Fit score = average of match_score across every application that has a
// computed match_score (i.e. embeddings finished on both sides). match_score
// itself is cosine similarity between the resume's embedding and the job's
// JD embedding, adjusted by services/matching.py's cross-domain penalty —
// this card just averages whatever the backend already computed per
// application, it doesn't run any scoring of its own.
function fitScoreColor(pct: number) {
  if (pct >= 0.7) return "text-success";
  if (pct >= 0.4) return "text-warning";
  return "text-danger";
}

function FitSnapshotCard({ overview, applications }: { overview: Overview | null; applications: Application[] }) {
  const scored = applications.filter((a) => a.match_score != null);
  const avgMatch = scored.length ? scored.reduce((sum, a) => sum + (a.match_score ?? 0), 0) / scored.length : null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Target size={15} />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Your fit snapshot</h2>
      </div>

      {avgMatch != null ? (
        <div className="flex items-center gap-3">
          <span className={`shrink-0 text-3xl font-bold tabular-nums ${fitScoreColor(avgMatch)}`}>
            {Math.round(avgMatch * 100)}%
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Average match across {scored.length} scored application{scored.length !== 1 ? "s" : ""}.
          </p>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Apply to a few roles to start seeing how your resume matches up.
        </p>
      )}

      {overview?.resume_categories && overview.resume_categories.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your matched areas</p>
          <div className="flex flex-wrap gap-1.5">
            {overview.resume_categories.slice(0, 6).map((c) => (
              <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                {c.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function SnapshotRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ApplicationSnapshotCard({ overview }: { overview: Overview | null }) {
  if (!overview) return null;
  const inProgress =
    (overview.status_counts["scenario_pending"] ?? 0) +
    (overview.status_counts["resume_passed"] ?? 0) +
    (overview.status_counts["scenario_submitted"] ?? 0);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Gauge size={15} />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Application snapshot</h2>
      </div>
      <div className="space-y-2.5">
        <SnapshotRow label="Total applications" value={overview.total_applications} />
        <SnapshotRow label="Shortlisted" value={overview.status_counts["shortlisted"] ?? 0} />
        <SnapshotRow label="In progress" value={inProgress} />
      </div>
      <Link href="/candidate/dashboard" className="mt-4 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary-hover">
        View full dashboard <ArrowRight size={12} />
      </Link>
    </Card>
  );
}

function RecentActivityCard({ applications }: { applications: Application[] }) {
  const recent = [...applications]
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
    .slice(0, 3);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <History size={15} />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
      </div>

      {recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">No applications yet — your activity will show up here.</p>
      ) : (
        <div className="space-y-1">
          {recent.map((app) => (
            <Link
              key={app.id}
              href={`/candidate/jobs/${app.job_id}`}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{app.job_title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{app.org_name}</p>
              </div>
              <StatusBadge status={app.status} className="shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main feed
// ---------------------------------------------------------------------------

function JobFeed() {
  const { toast } = useToast();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [switchingResume, setSwitchingResume] = useState(false);

  const [feedStatus, setFeedStatus] = useState<"loading" | "resume_required" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [resumeDropdownOpen, setResumeDropdownOpen] = useState(false);
  const resumeDropdownRef = useRef<HTMLDivElement>(null);
  const [isMac, setIsMac] = useState(false);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [defaultCategories, setDefaultCategories] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/candidates/me/overview");
        if (res.ok) {
          const data: Overview = await res.json();
          setOverview(data);
          const cats: string[] = data.resume_categories ?? [];
          setDefaultCategories(cats);
          setFilters((f) => ({ ...f, categories: cats }));
        }
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  // Ctrl+K / Cmd+K focuses search — the standard cross-app shortcut, unlike
  // the previous "/" binding which only made sense compared to no shortcut
  // at all.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isShortcut) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!resumeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (resumeDropdownRef.current && !resumeDropdownRef.current.contains(e.target as Node)) {
        setResumeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [resumeDropdownOpen]);

  const buildQuery = (f: Filters, cursor?: string | null) => {
    const params = new URLSearchParams();
    if (f.q.trim()) params.set("q", f.q.trim());
    if (f.location.trim()) params.set("location", f.location.trim());
    if (f.salary_min) params.set("salary_min", f.salary_min);
    if (f.salary_max) params.set("salary_max", f.salary_max);
    for (const c of f.categories) params.append("categories", c);
    for (const t of f.job_type) params.append("job_type", t);
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const loadFeed = async (f: Filters) => {
    const requestId = ++requestIdRef.current;
    setFeedStatus("loading");
    setNextCursor(null);
    setHasMore(false);
    try {
      const [jobsRes, appsRes, resumesRes] = await Promise.all([
        apiFetch(`/jobs/feed${buildQuery(f)}`),
        apiFetch("/applications/mine"),
        apiFetch("/resumes/"),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (jobsRes.status === 403) {
        const data = await jobsRes.json().catch(() => ({}));
        if (data.detail === "resume_required") {
          setFeedStatus("resume_required");
          return;
        }
        throw new Error(data.detail ?? "Access denied");
      }
      if (!jobsRes.ok) throw new Error("Failed to load jobs");

      const [jobsData, appsData, resumesData]: [JobFeedResponse, any, any] = await Promise.all([
        jobsRes.json(),
        appsRes.ok ? appsRes.json() : [],
        resumesRes.ok ? resumesRes.json() : [],
      ]);

      if (requestId !== requestIdRef.current) return;
      setJobs(Array.isArray(jobsData?.jobs) ? jobsData.jobs : []);
      setNextCursor(jobsData?.next_cursor ?? null);
      setHasMore(Boolean(jobsData?.has_more));
      setApplications(Array.isArray(appsData) ? appsData : []);
      setResumeVersions(Array.isArray(resumesData) ? resumesData : []);
      setFeedStatus("ok");
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;
      setError(e.message);
      setFeedStatus("error");
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const res = await apiFetch(`/jobs/feed${buildQuery(filters, nextCursor)}`);
      if (requestId !== requestIdRef.current) return;
      if (!res.ok) throw new Error("Failed to load more jobs");
      const data: JobFeedResponse = await res.json();
      if (requestId !== requestIdRef.current) return;
      setJobs((prev) => [...prev, ...(Array.isArray(data.jobs) ? data.jobs : [])]);
      setNextCursor(data.next_cursor ?? null);
      setHasMore(Boolean(data.has_more));
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, nextCursor, filters]);

  const handleResumeSwitch = async () => {
    try {
      const [overviewRes, resumesRes] = await Promise.all([
        apiFetch("/candidates/me/overview"),
        apiFetch("/resumes/"),
      ]);
      if (resumesRes.ok) setResumeVersions(await resumesRes.json());
      if (overviewRes.ok) {
        const data: Overview = await overviewRes.json();
        setOverview(data);
        const cats: string[] = data.resume_categories ?? [];
        setDefaultCategories(cats);
        setFilters((f) => ({ ...f, categories: cats }));
      } else {
        loadFeed(filters);
      }
    } catch {
      loadFeed(filters);
    }
  };

  const handleResumeSelectChange = async (id: string) => {
    const current = resumeVersions.find((r) => r.is_current);
    if (!id || id === current?.id) return;
    setSwitchingResume(true);
    try {
      const res = await apiFetch(`/resumes/${id}/set-current`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Failed to switch active resume");
      }
      await handleResumeSwitch();
      toast({ title: "Active resume switched", variant: "success" });
    } catch (e: any) {
      toast({ title: "Couldn't switch resume", description: e.message, variant: "error" });
    } finally {
      setSwitchingResume(false);
    }
  };

  useEffect(() => {
    if (!initialized) return;
    loadFeed(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, filters]);

  useEffect(() => {
    if (feedStatus !== "ok" || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [feedStatus, hasMore, loadMore]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters((f) => (f.q === searchDraft ? f : { ...f, q: searchDraft }));
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const resetAllFilters = () => {
    setSearchDraft("");
    setFilters({ ...EMPTY_FILTERS, categories: defaultCategories });
  };

  if (feedStatus === "resume_required") {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Card className="p-8">
          <h1 className="mb-2 text-xl font-bold text-foreground">Upload your resume first</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            You need to upload a resume before you can browse and apply to jobs.
          </p>
          <ResumeUpload onUploaded={() => loadFeed(filters)} />
        </Card>
      </div>
    );
  }

  const appliedJobIds = new Map(
    applications.filter((a) => a.status !== "withdrawn").map((a) => [a.job_id, a.status]),
  );
  const categoriesAreDefault =
    JSON.stringify([...filters.categories].sort()) === JSON.stringify([...defaultCategories].sort());
  // Counts every currently-applied filter, including categories seeded
  // from the resume by default — those are still actively narrowing the
  // feed, so hiding them from the count made "Filters" look inactive even
  // when it wasn't.
  const activeFilterCount =
    (filters.location ? 1 : 0) +
    (filters.salary_min || filters.salary_max ? 1 : 0) +
    filters.categories.length +
    filters.job_type.length;
  const hasActiveChips = Boolean(
    filters.location ||
      filters.salary_min ||
      filters.salary_max ||
      filters.categories.length > 0 ||
      filters.job_type.length > 0,
  );
  const activeSalaryLabel = findActiveSalaryBand(filters).label;
  return (
    <div className="w-full">
      {/* ─── Gradient hero header (matches dashboard style) ─── */}
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
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Job feed</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Find your next role
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Ranked by fit with your active resume</p>
          </div>
          <div className="animate-rise-in shrink-0" style={{ animationDelay: "100ms" }}>
            <Link href="/candidate/resumes">
              <Button rightIcon={<ArrowRight size={15} />}>Manage resumes</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 pt-5 pb-6">
        {/* Toolbar — search, resume switcher, filters button all in one row */}
        <Card className="mb-3 p-3 sm:p-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground " />
              <Input
                ref={searchInputRef}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search title, company, or type (e.g. intern)…"
                className="pl-8 pr-16"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                {isMac ? "⌘" : "Ctrl"}+K
              </kbd>
            </div>

            {resumeVersions.length > 1 && (() => {
              const currentResume = resumeVersions.find((r) => r.is_current);
              const currentLabel = currentResume?.label ?? (currentResume ? `Version ${currentResume.version_number}` : "Resume");
              return (
                <div ref={resumeDropdownRef} className="relative shrink-0 sm:w-60">
                  <button
                    onClick={() => setResumeDropdownOpen((o) => !o)}
                    disabled={switchingResume}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:opacity-60"
                  >
                    <FileText size={13} className="shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">{currentLabel}</span>
                    <ChevronDown
                      size={13}
                      className={`shrink-0 text-muted-foreground transition-transform ${resumeDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {resumeDropdownOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                      <p className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Switch active resume
                      </p>
                      <div className="max-h-56 overflow-y-auto p-1">
                        {resumeVersions.map((rv) => {
                          const label = rv.label ?? `Version ${rv.version_number}`;
                          const active = rv.is_current;
                          return (
                            <button
                              key={rv.id}
                              onClick={() => {
                                setResumeDropdownOpen(false);
                                handleResumeSelectChange(rv.id);
                              }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                                active
                                  ? "bg-primary/8 text-primary"
                                  : "text-foreground hover:bg-muted"
                              }`}
                            >
                              <FileText size={13} className={active ? "text-primary" : "text-muted-foreground"} />
                              <span className="flex-1 truncate text-left">{label}</span>
                              {active && <Check size={13} className="shrink-0 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <Button
              variant={activeFilterCount > 0 ? "primary" : "outline"}
              leftIcon={<SlidersHorizontal size={14} />}
              onClick={() => setShowFilters(true)}
              className="shrink-0"
            >
              Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Button>
          </div>
        </Card>

        {/* Active filter chips */}
        {hasActiveChips && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {filters.location && (
              <FilterChip onRemove={() => setFilters((f) => ({ ...f, location: "" }))}>📍 {filters.location}</FilterChip>
            )}
            {(filters.salary_min || filters.salary_max) && (
              <FilterChip onRemove={() => setFilters((f) => ({ ...f, salary_min: "", salary_max: "" }))}>
                {activeSalaryLabel}
              </FilterChip>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="min-w-0">
            {feedStatus === "loading" && (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {feedStatus === "ok" && jobs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Search size={19} />
                </div>
                <p className="text-sm font-medium text-foreground">No jobs match your filters</p>
                <p className="mt-1 text-xs text-muted-foreground">Try widening your search or clearing a few filters.</p>
                {hasActiveChips && (
                  <Button size="sm" variant="outline" className="mt-4" onClick={resetAllFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  applied={appliedJobIds.has(job.id)}
                  applicationStatus={appliedJobIds.get(job.id)}
                  onClick={() => setDetailJobId(job.id)}
                />
              ))}
            </div>

            {feedStatus === "ok" && hasMore && (
              <div ref={sentinelRef} className="py-8 text-center">
                <p className="text-xs animate-pulse text-muted-foreground">{loadingMore ? "Loading more jobs…" : ""}</p>
              </div>
            )}

            {feedStatus === "ok" && !hasMore && jobs.length > 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Search size={19} />
                </div>
                <p className="text-sm font-semibold text-foreground">That's all for now</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  We add new jobs regularly, check back soon, or widen your search to see more.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={resetAllFilters}>
                      Reset to profile
                  </Button>
                  {hasActiveChips && (
                      <Button size="sm" variant="outline" onClick={() => setFilters((f) => ({ ...f, categories: [] }))}>
                    Browse all categories
                  </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — fills the extra width on wide screens instead of leaving it empty */}
          <aside className="hidden space-y-4 lg:block">
            <FitSnapshotCard overview={overview} applications={applications} />
            <ApplicationSnapshotCard overview={overview} />
            <RecentActivityCard applications={applications} />
          </aside>
        </div>
      </div>

      <SlideOver
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title="Refine results"
        width="md"
        footer={
          <Button className="w-full" onClick={() => setShowFilters(false)}>
            Show results
          </Button>
        }
      >
        <FilterPanelContent
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters((f) => ({ ...f, categories: defaultCategories }))}
          categoriesAreDefault={categoriesAreDefault}
        />
      </SlideOver>

      {detailJobId && (
        <JobDetailModal
          jobId={detailJobId}
          application={
            applications.find((a) => a.job_id === detailJobId && a.status !== "withdrawn") as any
          }
          onClose={() => setDetailJobId(null)}
        />
      )}
    </div>
  );
}