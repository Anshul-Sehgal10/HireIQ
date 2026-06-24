"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";

interface Job {
  id: string;
  title: string;
  status: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  hiring_count: number;
}

interface Application {
  id: string;
  job_id: string;
  applicant_name?: string; // Adjust field names to match your exact ApplicationResponse schema
  applicant_email?: string;
  status: string;
  created_at: string;
}

export default function EmployerJobsPage() {
  return (
    <RoleGuard allowed={["employer", "admin"]}>
      <JobsContent />
    </RoleGuard>
  );
}

function JobsContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Track selected job for viewing applicants
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  useEffect(() => {
    apiFetch("/jobs/mine")
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.detail || "Failed to retrieve job collection.");
        }

        if (Array.isArray(data)) {
          setJobs(data);
          setFetchError(null);
        } else {
          setFetchError("Unexpected database layout returned from server.");
        }
      })
      .catch((err) => {
        console.error("Jobs retrieval failure:", err);
        setFetchError(
          err.message || "A routing or network connection error occurred.",
        );
      });
  }, []);

  const handlePublish = async (id: string) => {
    try {
      const res = await apiFetch(`/jobs/${id}/publish`, { method: "POST" });
      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, status: "published" } : j)),
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Failed to publish job.");
      }
    } catch (err) {
      alert("Network error. Could not complete request.");
    }
  };

  const handleClose = async (id: string) => {
    try {
      const res = await apiFetch(`/jobs/${id}/close`, { method: "POST" });
      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, status: "closed" } : j)),
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Failed to close job.");
      }
    } catch (err) {
      alert("Network error. Could not complete request.");
    }
  };

  // Handles fetching applicants for a given job ID
  const handleViewApplicants = async (jobId: string) => {
    setSelectedJobId(jobId);
    setLoadingApplicants(true);
    try {
      const res = await apiFetch(`/applications/job/${jobId}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setApplicants(data);
      } else {
        alert(data?.detail || "Failed to load applicants.");
      }
    } catch (err) {
      alert("Network error. Unable to load applicants.");
    } finally {
      setLoadingApplicants(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12 min-h-screen bg-gray-50/50">
      {/* Upper Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 mb-8 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your active listings and candidate pipelines</p>
        </div>
        {!selectedJobId && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all duration-200 hover:shadow-md focus:ring-2 focus:ring-indigo-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create New Posting
          </button>
        )}
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span><strong>Error:</strong> {fetchError}</span>
        </div>
      )}

      {/* Main Layout Workspace Switching */}
      {selectedJobId ? (
        /* APPLICANTS PIPELINE PAGE SUB-VIEW */
        <div className="space-y-6">
          <button
            onClick={() => setSelectedJobId(null)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to All Job Postings
          </button>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">
                Applicants for: <span className="text-indigo-600 font-medium">{jobs.find(j => j.id === selectedJobId)?.title}</span>
              </h2>
            </div>

            {loadingApplicants ? (
              <div className="py-16 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                Loading submissions...
              </div>
            ) : applicants.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-400 text-sm">No applications received for this job posting yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {applicants.map((app) => (
                  <div key={app.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/40 transition-colors">
                    <div>
                      <h3 className="font-semibold text-gray-900">{app.applicant_name || "Anonymous Applicant"}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{app.applicant_email || "No email documented"}</p>
                      <p className="text-xs text-gray-400 mt-2">Applied on {new Date(app.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {app.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* JOB BOARD MANAGER OVERVIEW */
        <div className="space-y-4">
          {showForm && (
            <JobForm
              onCreated={(job) => {
                setJobs((prev) => (Array.isArray(prev) ? [job, ...prev] : [job]));
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          )}

          <div className="grid gap-4">
            {Array.isArray(jobs) &&
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="group bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-lg font-bold text-gray-900 tracking-tight">{job.title}</h2>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                          {job.location || "Remote"}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="capitalize">{job.work_mode || "Full-time"}</span>
                        <span className="text-gray-300">•</span>
                        <span className="capitalize text-indigo-600 font-medium">{job.job_level} Level</span>
                        <span className="text-gray-300">•</span>
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold">
                          {job.hiring_count} open position{job.hiring_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 shrink-0 self-stretch md:self-auto justify-end">
                      {/* View Applicants Action Hook */}
                      <button
                        onClick={() => handleViewApplicants(job.id)}
                        className="inline-flex items-center gap-1.5 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl font-semibold transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        View Applicants
                      </button>

                      {job.status?.toLowerCase() === "draft" && (
                        <button
                          onClick={() => handlePublish(job.id)}
                          className="text-xs bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          Publish
                        </button>
                      )}
                      {job.status?.toLowerCase() === "published" && (
                        <button
                          onClick={() => handleClose(job.id)}
                          className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 px-3.5 py-2 rounded-xl font-semibold transition-colors"
                        >
                          Close
                        </button>
                      )}
                      {job.status?.toLowerCase() === "closed" && (
                        <button
                          onClick={() => handlePublish(job.id)}
                          className="text-xs bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          Publish Again
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

            {(!jobs || jobs.length === 0) && !fetchError && (
              <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.21.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-13.413 0c-1.07.16-1.837 1.094-1.837 2.175v3.784c0 .658.277 1.281.75 1.661m16.5 0a21.803 21.803 0 01-16.5 0m16.5 0c-2.227 1.134-4.715 1.76-7.35 1.76-2.635 0-5.123-.626-7.35-1.76M12 3v3.375m0-3.375a1.125 1.125 0 10-2.25 0M12 3a1.125 1.125 0 112.25 0m-2.25 3.375h3.375a1.125 1.125 0 011.125 1.125v2.25M12 6.375H8.625A1.125 1.125 0 007.5 7.5v2.25" />
                </svg>
                <p className="text-gray-500 font-medium">No job postings found yet</p>
                <p className="text-sm text-gray-400 mt-1">Get started by building your first active hiring pipeline.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase() || "draft";
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    published: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    closed: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border capitalize tracking-wide ${styles[normalized] ?? styles.draft}`}
    >
      {status}
    </span>
  );
}

function JobForm({
  onCreated,
  onCancel,
}: {
  onCreated: (j: Job) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    work_mode: "",
    job_level: "",
    hiring_count: 1,
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description are required fields.");
      return;
    }
    if (form.title.trim().length < 3 || form.title.trim().length > 255) {
      setError("Title must be between 3 and 255 characters.");
      return;
    }
    if (form.description.trim().length < 50) {
      setError("Job description must be at least 50 characters long.");
      return;
    }

    setError("");
    try {
      const res = await apiFetch("/jobs/", {
        method: "POST",
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || "Failed to create job posting.");
        return;
      }
      onCreated(data);
    } catch (err) {
      setError("Network connectivity issue. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border-2 border-indigo-100 rounded-2xl p-6 mb-8 shadow-sm space-y-5"
    >
      <div>
        <h2 className="text-xl font-bold text-gray-900">New Job Listing</h2>
        <p className="text-xs text-gray-500 mt-0.5">Define your position criteria and requirements</p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Job Title</label>
          <input
            placeholder="e.g. Senior Software Engineer"
            value={form.title}
            required
            minLength={3}
            maxLength={255}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Job Description</label>
          <textarea
            placeholder="Describe expectations, roles, core tech requirements... (minimum 50 characters)"
            rows={5}
            value={form.description}
            required
            minLength={50}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Location</label>
            <input
              placeholder="e.g. London, UK"
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Work Mode</label>
            <select
              value={form.work_mode}
              onChange={(e) => setForm((p) => ({ ...p, work_mode: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            >
              <option value="">Select Mode</option>
              <option value="remote">Remote</option>
              <option value="onsite">Onsite</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Experience Level</label>
            <select
              value={form.job_level}
              onChange={(e) => setForm((p) => ({ ...p, job_level: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            >
              <option value="">Select Level</option>
              <option value="fresher">Fresher</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Hiring Count</label>
            <input
              type="number"
              min={1}
              value={form.hiring_count}
              onChange={(e) => setForm((p) => ({ ...p, hiring_count: Math.max(1, Number(e.target.value)) }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-600 bg-gray-100 hover:bg-gray-200 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          Save Posting
        </button>
      </div>
    </form>
  );
}