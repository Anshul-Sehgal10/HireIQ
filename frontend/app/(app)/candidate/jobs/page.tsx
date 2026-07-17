"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { RoleGuard } from "@/components/RoleGuard";
import JobDetailModal from "@/components/JobDetailModal";
import ResumeUpload from "@/components/ResumeUpload";

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

// Shape actually returned by GET /jobs/feed as of the pagination change
interface JobFeedResponse {
  jobs: Job[];
  next_cursor: string | null;
  has_more: boolean;
}

export default function CandidateJobsPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <JobFeed />
    </RoleGuard>
  );
}

function ActiveResumeSwitcher({
  resumeVersions,
  onSwitched,
}: {
  resumeVersions: ResumeVersion[];
  onSwitched: () => void;
}) {
  const [switching, setSwitching] = useState(false);
  const current = resumeVersions.find((r) => r.is_current);

  if (resumeVersions.length <= 1) return null;

  const handleChange = async (id: string) => {
    if (!id || id === current?.id) return;
    setSwitching(true);
    try {
      const res = await apiFetch(`/resumes/${id}/set-current`, {
        method: "POST",
      });
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
    <div className="flex items-center gap-2 text-sm mb-4">
      <span className="text-muted-foreground">Applying with:</span>
      <select
        value={current?.id ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        disabled={switching}
        className="border border-input rounded-lg px-2.5 py-1.5 text-sm text-foreground bg-card"
      >
        {resumeVersions.map((rv) => (
          <option key={rv.id} value={rv.id}>
            {rv.label ?? `Version ${rv.version_number}`}
          </option>
        ))}
      </select>
      {switching && (
        <span className="text-xs text-muted-foreground animate-pulse">
          Switching…
        </span>
      )}
    </div>
  );
}

interface Filters {
  q: string;
  categories: string[];
  location: string;
  salary_min: string;
  salary_max: string;
}

function FilterBar({
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
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  };

  return (
    <div className="mb-6 space-y-3">
      <input
        value={filters.q}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
        placeholder="Search by job title or company…"
        className="w-full border border-input rounded-lg px-4 py-2.5 text-sm text-foreground bg-card"
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filters.location}
          onChange={(e) => onChange({ ...filters, location: e.target.value })}
          placeholder="Location"
          className="border border-input rounded-lg px-3 py-1.5 text-sm text-foreground bg-card w-36"
        />
        <input
          type="number"
          value={filters.salary_min}
          onChange={(e) => onChange({ ...filters, salary_min: e.target.value })}
          placeholder="Min salary"
          className="border border-input rounded-lg px-3 py-1.5 text-sm text-foreground bg-card w-28"
        />
        <input
          type="number"
          value={filters.salary_max}
          onChange={(e) => onChange({ ...filters, salary_max: e.target.value })}
          placeholder="Max salary"
          className="border border-input rounded-lg px-3 py-1.5 text-sm text-foreground bg-card w-28"
        />
        <button
          onClick={() => setShowCategoryPicker((v) => !v)}
          className="text-sm border border-input rounded-lg px-3 py-1.5 text-foreground bg-card"
        >
          Categories{" "}
          {filters.categories.length > 0 && `(${filters.categories.length})`}
        </button>
        {!categoriesAreDefault && (
          <button
            onClick={onReset}
            className="text-xs text-primary hover:text-primary-hover"
          >
            Reset to my profile filters
          </button>
        )}
        {filters.categories.length > 0 && (
          <button
            onClick={() => onChange({ ...filters, categories: [] })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear categories (show all)
          </button>
        )}
      </div>

      {showCategoryPicker && (
        <div className="flex flex-wrap gap-1.5 border border-border rounded-lg p-3 bg-muted">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full capitalize border transition-colors ${
                filters.categories.includes(cat)
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              {cat.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_FILTERS: Filters = {
  q: "",
  categories: [],
  location: "",
  salary_min: "",
  salary_max: "",
};

function JobFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [feedStatus, setFeedStatus] = useState<
    "loading" | "resume_required" | "ok" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  // --- pagination state ---
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [defaultCategories, setDefaultCategories] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

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

  // Initial / filter-change load — resets the list and cursor.
  const loadFeed = async (f: Filters) => {
    setFeedStatus("loading");
    setNextCursor(null);
    setHasMore(false);
    try {
      const [jobsRes, appsRes, resumesRes] = await Promise.all([
        apiFetch(`/jobs/feed${buildQuery(f)}`),
        apiFetch("/applications/mine"),
        apiFetch("/resumes/"),
      ]);

      if (jobsRes.status === 403) {
        const data = await jobsRes.json().catch(() => ({}));
        if (data.detail === "resume_required") {
          setFeedStatus("resume_required");
          return;
        }
        throw new Error(data.detail ?? "Access denied");
      }
      if (!jobsRes.ok) throw new Error("Failed to load jobs");

      const [jobsData, appsData, resumesData]: [JobFeedResponse, any, any] =
        await Promise.all([
          jobsRes.json(),
          appsRes.ok ? appsRes.json() : [],
          resumesRes.ok ? resumesRes.json() : [],
        ]);

      setJobs(Array.isArray(jobsData?.jobs) ? jobsData.jobs : []);
      setNextCursor(jobsData?.next_cursor ?? null);
      setHasMore(Boolean(jobsData?.has_more));
      setApplications(Array.isArray(appsData) ? appsData : []);
      setResumeVersions(Array.isArray(resumesData) ? resumesData : []);
      setFeedStatus("ok");
    } catch (e: any) {
      setError(e.message);
      setFeedStatus("error");
    }
  };

  // Appends the next page onto the existing list — used by infinite scroll.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await apiFetch(
        `/jobs/feed${buildQuery(filters, nextCursor)}`,
      );
      if (!res.ok) throw new Error("Failed to load more jobs");
      const data: JobFeedResponse = await res.json();
      setJobs((prev) => [
        ...prev,
        ...(Array.isArray(data.jobs) ? data.jobs : []),
      ]);
      setNextCursor(data.next_cursor ?? null);
      setHasMore(Boolean(data.has_more));
    } catch (e: any) {
      // Non-fatal — the existing list stays visible; just stop trying to
      // auto-load further until the user retries (e.g. by changing filters).
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

      if (resumesRes.ok) {
        const resumesData = await resumesRes.json();
        setResumeVersions(Array.isArray(resumesData) ? resumesData : []);
      }

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        const cats: string[] = data.resume_categories ?? [];
        setDefaultCategories(cats);
        // Updating filters triggers the existing useEffect([initialized, filters])
        // which calls loadFeed(filters) for us — no need to call it directly.
        setFilters((f) => ({ ...f, categories: cats }));
      } else {
        // Overview failed — fall back to at least refreshing the feed as-is.
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

  // IntersectionObserver on the sentinel div at the bottom of the list.
  useEffect(() => {
    if (feedStatus !== "ok" || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" }, // start loading before the user hits bottom
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [feedStatus, hasMore, loadMore]);

  const handleWithdraw = async (jobId: string) => {
    const application = applications.find(
      (a) => a.job_id === jobId && a.status !== "withdrawn",
    );
    if (!application) return;
    try {
      const res = await apiFetch(`/applications/${application.id}/withdraw`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Failed to withdraw");
      }
      setApplications((prev) =>
        prev.map((a) =>
          a.id === application.id ? { ...a, status: "withdrawn" } : a,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (feedStatus === "resume_required") {
    return (
      <div className="max-w-lg mx-auto p-8">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-bold text-foreground mb-2">
            Upload your resume first
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            You need to upload a resume before you can browse and apply to jobs.
          </p>
          <ResumeUpload onUploaded={() => loadFeed(filters)} />
        </div>
      </div>
    );
  }

  const appliedJobIds = new Set(
    applications.filter((a) => a.status !== "withdrawn").map((a) => a.job_id),
  );
  const categoriesAreDefault =
    JSON.stringify([...filters.categories].sort()) ===
    JSON.stringify([...defaultCategories].sort());

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Job Feed</h1>
        <Link
          href="/candidate/resumes"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Manage resumes
        </Link>
      </div>

      <ActiveResumeSwitcher resumeVersions={resumeVersions} onSwitched={handleResumeSwitch} />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() =>
          setFilters((f) => ({ ...f, categories: defaultCategories }))
        }
        categoriesAreDefault={categoriesAreDefault}
      />

      {error && (
        <div className="mb-4 bg-danger-bg border border-danger-border text-danger-foreground px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {feedStatus === "loading" && (
        <p className="text-muted-foreground text-sm text-center py-12 animate-pulse">
          Loading jobs…
        </p>
      )}

      {feedStatus === "ok" && jobs.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">
          No jobs match your filters.
        </p>
      )}

      <div className="space-y-4">
        {jobs.map((job) => {
          const applied = appliedJobIds.has(job.id);
          const meta = [job.location, job.work_mode, job.job_level]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={job.id}
              onClick={() => setDetailJobId(job.id)}
              className="border border-border rounded-xl p-5 bg-card shadow-sm cursor-pointer hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground text-base">
                    {job.title}
                  </h2>
                  {job.org_name && (
                    <p className="text-sm text-muted-foreground">
                      {job.org_name}
                    </p>
                  )}
                  {job.scenario_enabled && (
                    <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium mt-1">
                      Scenario question
                    </span>
                  )}
                  {meta && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {meta}
                    </p>
                  )}
                  {job.categories && job.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {job.categories.map((c) => (
                        <span
                          key={c}
                          className="inline-block bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full capitalize"
                        >
                          {c.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                  {(job.salary_min || job.salary_max) && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {job.salary_min && job.salary_max
                        ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
                        : job.salary_min
                          ? `From ₹${job.salary_min.toLocaleString()}`
                          : `Up to ₹${job.salary_max!.toLocaleString()}`}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
                    {job.description}
                  </p>
                </div>
                <div className="shrink-0">
                  {applied && (
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs bg-success-bg text-success-foreground px-2.5 py-1 rounded-full font-medium">
                        Applied
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWithdraw(job.id);
                        }}
                        className="text-xs text-muted-foreground hover:text-danger transition-colors"
                      >
                        Withdraw
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Infinite scroll trigger + trailing loading state */}
      {feedStatus === "ok" && hasMore && (
        <div ref={sentinelRef} className="py-8 text-center">
          <p className="text-xs text-muted-foreground animate-pulse">
            {loadingMore ? "Loading more jobs…" : ""}
          </p>
        </div>
      )}
      {feedStatus === "ok" && !hasMore && jobs.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">
          You've reached the end of the feed.
        </p>
      )}

      {detailJobId && (
        <JobDetailModal
          jobId={detailJobId}
          resumeVersions={resumeVersions}
          application={applications.find(
            (a) => a.job_id === detailJobId && a.status !== "withdrawn",
          )}
          onClose={() => setDetailJobId(null)}
          onApplied={(application) => {
            setApplications((prev) => [...prev, application] as any);
            setDetailJobId(null);
          }}
        />
      )}
    </div>
  );
}
