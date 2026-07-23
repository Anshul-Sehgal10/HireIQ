"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RoleGuard } from "@/components/RoleGuard";
import JobDetailModal from "@/components/JobDetailModal";
import JobCard from "@/components/JobCard";
import ResumeUpload from "@/components/ResumeUpload";
import { PageHeader, Card, SkeletonCard, Button, Input } from "@/components/ui";

const ALL_CATEGORIES = [
  "backend", "frontend", "fullstack", "mobile", "devops_cloud", "data_ml",
  "qa_testing", "security", "design_ux", "product_management",
  "embedded_systems", "game_dev", "blockchain", "sales", "marketing",
  "hr_recruiting", "finance", "operations", "customer_support", "other",
];

interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  hiring_count: number;
  salary_min: number | null;
  salary_max: number | null;
  org_id: string;
  org_name: string | null;
  categories: string[] | null;
  scenario_enabled: boolean;
  role_summary: string | null;
}

interface Application {
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

interface ResumeVersion {
  id: string;
  version_number: number;
  label: string | null;
  s3_key: string;
  created_at: string;
  is_current: boolean;
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
}

const EMPTY_FILTERS: Filters = { q: "", categories: [], location: "", salary_min: "", salary_max: "" };

export default function CandidateJobsPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <JobFeed />
    </RoleGuard>
  );
}

function ActiveResumeSwitcher({ resumeVersions, onSwitched }: { resumeVersions: ResumeVersion[]; onSwitched: () => void }) {
  const [switching, setSwitching] = useState(false);
  const current = resumeVersions.find((r) => r.is_current);
  if (resumeVersions.length <= 1) return null;

  const handleChange = async (id: string) => {
    if (!id || id === current?.id) return;
    setSwitching(true);
    try {
      const res = await apiFetch(`/resumes/${id}/set-current`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Failed to switch active resume");
      }
      onSwitched();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="mb-4 flex items-center gap-2 text-sm">
      <FileText size={14} className="text-muted-foreground" />
      <span className="text-muted-foreground">Applying with:</span>
      <select
        value={current?.id ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        disabled={switching}
        className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {resumeVersions.map((rv) => (
          <option key={rv.id} value={rv.id}>{rv.label ?? `Version ${rv.version_number}`}</option>
        ))}
      </select>
      {switching && <span className="text-xs animate-pulse text-muted-foreground">Switching…</span>}
    </div>
  );
}

const SALARY_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: "Any" },
  { label: "Up to ₹5L", max: 500000 },
  { label: "₹5L – 10L", min: 500000, max: 1000000 },
  { label: "₹10L – 15L", min: 1000000, max: 1500000 },
  { label: "₹15L – 25L", min: 1500000, max: 2500000 },
  { label: "₹25L – 40L", min: 2500000, max: 4000000 },
  { label: "₹40L+", min: 4000000 },
];

function FilterPanel({
  filters, onChange, onReset, categoriesAreDefault, onClose,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  categoriesAreDefault: boolean;
  onClose: () => void;
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

  const activeBand =
    SALARY_BANDS.find(
      (b) => (b.min?.toString() ?? "") === filters.salary_min && (b.max?.toString() ?? "") === filters.salary_max,
    ) ?? SALARY_BANDS[0];

  const selectBand = (band: (typeof SALARY_BANDS)[number]) => {
    onChange({ ...filters, salary_min: band.min?.toString() ?? "", salary_max: band.max?.toString() ?? "" });
  };

  const filteredCategories = ALL_CATEGORIES.filter((c) => c.toLowerCase().includes(catQuery.toLowerCase()));

  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  };

  return (
    <Card className="mb-5 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Refine results</h3>
        <button onClick={onClose} aria-label="Close filters" className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X size={15} />
        </button>
      </div>

      {/* Location */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
        <Input placeholder="City or remote" value={locDraft} onChange={(e) => commitLocation(e.target.value)} />
      </div>

      {/* Salary — scrollable selector */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salary range</p>
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
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

      {/* Categories */}
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

        <Input placeholder="Search categories…" value={catQuery} onChange={(e) => setCatQuery(e.target.value)} className="mb-2.5" />

        <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2.5">
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
    </Card>
  );
}

function JobFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [feedStatus, setFeedStatus] = useState<"loading" | "resume_required" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [defaultCategories, setDefaultCategories] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/candidates/me/overview");
        if (res.ok) {
          const data = await res.json();
          const cats: string[] = data.resume_categories ?? [];
          setDefaultCategories(cats);
          setFilters((f) => ({ ...f, categories: cats }));
        }
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  const buildQuery = (f: Filters, cursor?: string | null) => {
    const params = new URLSearchParams();
    if (f.q.trim()) params.set("q", f.q.trim());
    if (f.location.trim()) params.set("location", f.location.trim());
    if (f.salary_min) params.set("salary_min", f.salary_min);
    if (f.salary_max) params.set("salary_max", f.salary_max);
    for (const c of f.categories) params.append("categories", c);
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
        const data = await overviewRes.json();
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

  useEffect(() => {
    if (!initialized) return;
    loadFeed(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, filters]);

  useEffect(() => {
    if (feedStatus !== "ok" || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) loadMore(); }, { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [feedStatus, hasMore, loadMore]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters((f) => (f.q === searchDraft ? f : { ...f, q: searchDraft }));
    }, 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const handleWithdraw = async (jobId: string) => {
    const application = applications.find((a) => a.job_id === jobId && a.status !== "withdrawn");
    if (!application) return;
    try {
      const res = await apiFetch(`/applications/${application.id}/withdraw`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Failed to withdraw");
      }
      setApplications((prev) => prev.map((a) => (a.id === application.id ? { ...a, status: "withdrawn" } : a)));
    } catch (e: any) {
      setError(e.message);
    }
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

  const appliedJobIds = new Map(applications.filter((a) => a.status !== "withdrawn").map((a) => [a.job_id, a.status]));
  const categoriesAreDefault = JSON.stringify([...filters.categories].sort()) === JSON.stringify([...defaultCategories].sort());
  const activeFilterCount =
    (filters.location ? 1 : 0) + (filters.salary_min ? 1 : 0) + (filters.salary_max ? 1 : 0) +
    (categoriesAreDefault ? 0 : filters.categories.length);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Job feed"
        description="Ranked by fit with your active resume"
        actions={
          <Link href="/candidate/resumes" className="text-sm text-muted-foreground hover:text-foreground">
            Manage resumes
          </Link>
        }
      />

      <div className="p-6">
        <ActiveResumeSwitcher resumeVersions={resumeVersions} onSwitched={handleResumeSwitch} />

        <div className="mb-5 flex gap-3">
          <div className="relative flex-1">
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search by job title or company…"
            />
          </div>
          <Button
            variant={showFilters || activeFilterCount > 0 ? "primary" : "outline"}
            leftIcon={<SlidersHorizontal size={14} />}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
          </Button>
        </div>

        {showFilters && (
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters((f) => ({ ...f, categories: defaultCategories }))}
            categoriesAreDefault={categoriesAreDefault}
            onClose={() => setShowFilters(false)}
          />
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
            {error}
          </div>
        )}

        {feedStatus === "loading" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {feedStatus === "ok" && jobs.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No jobs match your filters.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <p className="py-8 text-center text-xs text-muted-foreground">You've reached the end of the feed.</p>
        )}
      </div>

      {detailJobId && (
        <JobDetailModal
          jobId={detailJobId}
          resumeVersions={resumeVersions}
          application={applications.find((a) => a.job_id === detailJobId && a.status !== "withdrawn") as any}
          onClose={() => setDetailJobId(null)}
          onApplied={(application) => {
            setApplications((prev) => [...prev, application] as any);
            setDetailJobId(null);
          }}
          onWithdrawn={(jobId) => {
            handleWithdraw(jobId);
            setDetailJobId(null);
          }}
        />
      )}
    </div>
  );
}