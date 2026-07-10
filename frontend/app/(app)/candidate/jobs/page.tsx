"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { RoleGuard } from "@/components/RoleGuard";
import JobDetailModal from "@/components/JobDetailModal";
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
  categories: string[] | null;
}

interface Application {
  id: string;
  job_id: string;
  status: string;
}

interface ResumeVersion {
  id: string;
  version_number: number;
  label: string | null;
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
      onSwitched(); // reload feed — categories used for filtering may have changed
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm mb-4">
      <span className="text-gray-500">Applying with:</span>
      <select
        value={current?.id ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        disabled={switching}
        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white"
      >
        {resumeVersions.map((rv) => (
          <option key={rv.id} value={rv.id}>
            {rv.label ?? `Version ${rv.version_number}`}
          </option>
        ))}
      </select>
      {switching && (
        <span className="text-xs text-gray-400 animate-pulse">Switching…</span>
      )}
    </div>
  );
}

function JobFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [feedStatus, setFeedStatus] = useState<
    "loading" | "resume_required" | "ok" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  const loadFeed = async () => {
    setFeedStatus("loading");
    try {
      const [jobsRes, appsRes, resumesRes] = await Promise.all([
        apiFetch("/jobs/feed"),
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

  useEffect(() => {
    loadFeed();
  }, []);

  const handleWithdraw = async (jobId: string) => {
    const application = applications.find(
      (item) => item.job_id === jobId && item.status !== "withdrawn",
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
        prev.map((item) =>
          item.id === application.id ? { ...item, status: "withdrawn" } : item,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (feedStatus === "resume_required") {
    return (
      <div className="max-w-lg mx-auto p-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Upload your resume first
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            You need to upload a resume before you can browse and apply to jobs.
            Your resume will be used to match you with relevant roles.
          </p>
          <ResumeUpload onUploaded={loadFeed} />
        </div>
      </div>
    );
  }

  if (feedStatus === "loading") {
    return (
      <div className="p-8 text-gray-400 text-sm animate-pulse">
        Loading jobs…
      </div>
    );
  }

  const appliedJobIds = new Set(
    applications
      .filter((item) => item.status !== "withdrawn")
      .map((item) => item.job_id),
  );

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Job Feed</h1>
        <Link
          href="/candidate/resumes"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Manage resumes
        </Link>
      </div>

      <ActiveResumeSwitcher
        resumeVersions={resumeVersions}
        onSwitched={loadFeed}
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {jobs.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-12">
          No jobs posted yet.
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
              className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 text-base">
                    {job.title}
                  </h2>
                  {meta && (
                    <p className="text-sm text-gray-500 mt-0.5">{meta}</p>
                  )}
                  {job.categories && job.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {job.categories.map((category) => (
                        <span
                          key={category}
                          className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  )}
                  {(job.salary_min || job.salary_max) && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {job.salary_min && job.salary_max
                        ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
                        : job.salary_min
                          ? `From ₹${job.salary_min.toLocaleString()}`
                          : `Up to ₹${job.salary_max!.toLocaleString()}`}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-3 line-clamp-3">
                    {job.description}
                  </p>
                </div>
                <div className="shrink-0">
                  {applied ? (
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                        Applied
                      </span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleWithdraw(job.id);
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Withdraw
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {detailJobId && (
        <JobDetailModal
          jobId={detailJobId}
          resumeVersions={resumeVersions}
          alreadyApplied={appliedJobIds.has(detailJobId)}
          onClose={() => setDetailJobId(null)}
          onApplied={(application) => {
            setApplications((prev) => [...prev, application]);
            setDetailJobId(null);
          }}
        />
      )}
    </div>
  );
}
