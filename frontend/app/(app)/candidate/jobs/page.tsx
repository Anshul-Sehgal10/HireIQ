"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { RoleGuard } from "@/components/RoleGuard";

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
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/jobs/feed").then(r => r.json()),
      apiFetch("/applications/mine").then(r => r.json()),
    ]).then(([jobsData, appsData]) => {
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setApplications(Array.isArray(appsData) ? appsData : []);
    }).catch(() => setError("Failed to load jobs."))
      .finally(() => setLoading(false));
  }, []);

  const appliedJobIds = new Set(
    applications
      .filter(a => a.status !== "withdrawn")
      .map(a => a.job_id)
  );

  const handleApply = async (jobId: string) => {
    setApplying(jobId);
    setError(null);
    try {
      const res = await apiFetch("/applications/", {
        method: "POST",
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to apply");
      setApplications(prev => [...prev, { id: data.id, job_id: jobId, status: "pending" }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplying(null);
    }
  };

  const handleWithdraw = async (jobId: string) => {
    const app = applications.find(a => a.job_id === jobId && a.status !== "withdrawn");
    if (!app) return;
    setApplying(jobId);
    try {
      const res = await apiFetch(`/applications/${app.id}/withdraw`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Failed to withdraw");
      }
      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, status: "withdrawn" } : a)
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplying(null);
    }
  };

  if (loading) return (
    <div className="p-8 text-gray-400 text-sm animate-pulse">Loading jobs…</div>
  );

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Job Feed</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {jobs.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-12">No jobs posted yet.</p>
      )}

      <div className="space-y-4">
        {jobs.map(job => {
          const applied = appliedJobIds.has(job.id);
          const isApplying = applying === job.id;
          const meta = [job.location, job.work_mode, job.job_level]
            .filter(Boolean).join(" · ");

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
                        disabled={isApplying}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {isApplying ? "…" : "Withdraw"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleApply(job.id)}
                      disabled={isApplying}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {isApplying ? "Applying…" : "Apply"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}