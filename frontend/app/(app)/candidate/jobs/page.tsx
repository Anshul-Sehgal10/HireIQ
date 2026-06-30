"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { RoleGuard } from "@/components/RoleGuard";
import ResumeUpload from "@/components/ResumeUpload";

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
}

interface Application {
  id: string;
  job_id: string;
  status: string;
}

interface ResumeVersion {
  id: string;
  version_number: number;
  s3_key: string;
  created_at: string;
  is_current: boolean;
}

export default function CandidateJobsPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <JobFeed />
    </RoleGuard>
  );
}

function JobFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);

  // "resume_required" = no resume uploaded yet; null = loaded fine; string = other error
  const [feedStatus, setFeedStatus] = useState<"loading" | "resume_required" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  // Apply modal state
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const loadFeed = async () => {
    setFeedStatus("loading");
    try {
      const [jobsRes, appsRes, resumesRes] = await Promise.all([
        apiFetch("/jobs/feed"),
        apiFetch("/applications/mine"),
        apiFetch("/resumes/"),
      ]);

      // 403 detail="resume_required" → show upload gate
      if (jobsRes.status === 403) {
        const d = await jobsRes.json().catch(() => ({}));
        if (d.detail === "resume_required") {
          setFeedStatus("resume_required");
          return;
        }
        throw new Error(d.detail ?? "Access denied");
      }

      if (!jobsRes.ok) throw new Error("Failed to load jobs");

      const [jobsData, appsData, resumesData] = await Promise.all([
        jobsRes.json(),
        appsRes.ok ? appsRes.json() : [],
        resumesRes.ok ? resumesRes.json() : [],
      ]);

      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setApplications(Array.isArray(appsData) ? appsData : []);
      setResumeVersions(Array.isArray(resumesData) ? resumesData : []);
      setFeedStatus("ok");
    } catch (e: any) {
      setError(e.message);
      setFeedStatus("error");
    }
  };

  useEffect(() => { loadFeed(); }, []);

  // Set default selected resume to current active version when modal opens
  const openApplyModal = (job: Job) => {
    const current = resumeVersions.find((r) => r.is_current);
    setSelectedResumeId(current?.id ?? resumeVersions[0]?.id ?? "");
    setApplyError(null);
    setApplyingJob(job);
  };

  const handleApply = async () => {
    if (!applyingJob) return;
    setApplying(true);
    setApplyError(null);
    try {
      const body: Record<string, string> = { job_id: applyingJob.id };
      if (selectedResumeId) body.resume_version_id = selectedResumeId;

      const res = await apiFetch("/applications/", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to apply");
      setApplications((prev) => [...prev, { id: data.id, job_id: applyingJob.id, status: "pending" }]);
      setApplyingJob(null);
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async (jobId: string) => {
    const app = applications.find((a) => a.job_id === jobId && a.status !== "withdrawn");
    if (!app) return;
    try {
      const res = await apiFetch(`/applications/${app.id}/withdraw`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Failed to withdraw");
      }
      setApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: "withdrawn" } : a))
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  // -------------------------------------------------------------------------
  // Resume gate — shown when no resume has been uploaded yet
  // -------------------------------------------------------------------------
  if (feedStatus === "resume_required") {
    return (
      <div className="max-w-lg mx-auto p-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Upload your resume first</h1>
          <p className="text-gray-500 text-sm mb-6">
            You need to upload a resume before you can browse and apply to jobs.
            Your resume will be used to match you with relevant roles.
          </p>
          <ResumeUpload
            onUploaded={() => {
              // Resume uploaded — reload the feed
              loadFeed();
            }}
          />
        </div>
      </div>
    );
  }

  if (feedStatus === "loading") return (
    <div className="p-8 text-gray-400 text-sm animate-pulse">Loading jobs…</div>
  );

  const appliedJobIds = new Set(
    applications.filter((a) => a.status !== "withdrawn").map((a) => a.job_id)
  );

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Job Feed</h1>
        {/* Let candidate upload a new version anytime */}
        <UploadNewVersionButton
          resumeVersions={resumeVersions}
          onUploaded={(v) => {
            setResumeVersions((prev) =>
              [v, ...prev.map((r) => ({ ...r, is_current: false }))]
            );
          }}
        />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {jobs.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-12">No jobs posted yet.</p>
      )}

      <div className="space-y-4">
        {jobs.map((job) => {
          const applied = appliedJobIds.has(job.id);
          const meta = [job.location, job.work_mode, job.job_level].filter(Boolean).join(" · ");

          return (
            <div key={job.id} className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 text-base">{job.title}</h2>
                  {meta && <p className="text-sm text-gray-500 mt-0.5">{meta}</p>}
                  {(job.salary_min || job.salary_max) && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {job.salary_min && job.salary_max
                        ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
                        : job.salary_min
                          ? `From ₹${job.salary_min.toLocaleString()}`
                          : `Up to ₹${job.salary_max!.toLocaleString()}`}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-3 line-clamp-3">{job.description}</p>
                </div>
                <div className="shrink-0">
                  {applied ? (
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                        Applied
                      </span>
                      <button
                        onClick={() => handleWithdraw(job.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Withdraw
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openApplyModal(job)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Apply modal — resume version picker */}
      {applyingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Apply to {applyingJob.title}</h2>
            <p className="text-sm text-gray-500 mb-5">
              Choose which resume version to submit with this application.
            </p>

            <div className="space-y-2 mb-5">
              {resumeVersions.map((rv) => (
                <label
                  key={rv.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedResumeId === rv.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="resume"
                    value={rv.id}
                    checked={selectedResumeId === rv.id}
                    onChange={() => setSelectedResumeId(rv.id)}
                    className="text-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Version {rv.version_number}
                      {rv.is_current && (
                        <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                          current
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {new Date(rv.created_at).toLocaleDateString()} · {rv.s3_key.split("/").pop()}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {applyError && (
              <p className="text-sm text-red-500 mb-4">{applyError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setApplyingJob(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying || !selectedResumeId}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {applying ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Inline "Upload new version" button + popover
// ---------------------------------------------------------------------------

function UploadNewVersionButton({
  resumeVersions,
  onUploaded,
}: {
  resumeVersions: ResumeVersion[];
  onUploaded: (v: ResumeVersion) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentVersion = resumeVersions.find((r) => r.is_current);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {currentVersion ? `Resume v${currentVersion.version_number}` : "Upload resume"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-30">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Upload new version
          </p>
          <ResumeUpload
            onUploaded={(v) => {
              onUploaded(v);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}