"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import ExtractionDetailModal from "@/components/ExtractionDetailModal";

interface JobDetail {
  id: string;
  title: string;
  categories: string[] | null;
  parsed_data: Record<string, any> | null;
  has_embedding: boolean;
}

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
  candidate_id: string;
  applicant_name: string;
  applicant_email: string;
  status: string;
  match_score: number | null;
  is_override: boolean;
  applied_at: string;
  resume_version_id: string;
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

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const [detailFor, setDetailFor] = useState<JobDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/jobs/mine")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(data?.detail || "Failed to retrieve jobs.");
        if (Array.isArray(data)) {
          setJobs(data);
          setFetchError(null);
        } else {
          setFetchError("Unexpected response from server.");
        }
      })
      .catch((err) => {
        setFetchError(err.message || "A network error occurred.");
      });
  }, []);

  const handlePublish = async (id: string) => {
    const res = await apiFetch(`/jobs/${id}/publish`, { method: "POST" });
    if (res.ok) {
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: "published" } : j)),
      );
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.detail || "Failed to publish job.");
    }
  };

  const handleReprocess = async (id: string) => {
    const res = await apiFetch(`/jobs/${id}/reprocess`, { method: "POST" });
    if (res.ok) {
      const updated: Job = await res.json();
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, ...updated } : j)),
      );
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.detail || "Failed to reprocess job description.");
    }
  };

  const handleClose = async (id: string) => {
    const res = await apiFetch(`/jobs/${id}/close`, { method: "POST" });
    if (res.ok) {
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: "closed" } : j)),
      );
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.detail || "Failed to close job.");
    }
  };

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
    } finally {
      setLoadingApplicants(false);
    }
  };

  const viewDetails = async (id: string) => {
    setLoadingDetail(id);
    try {
      const res = await apiFetch(`/jobs/${id}/details`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to load details");
      setDetailFor(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoadingDetail(null);
    }
  };

  const handleGenerateScenario = async (id: string) => {
    const res = await apiFetch(`/jobs/${id}/scenario/generate`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || "Scenario generation failed.");
      return;
    }
    alert(
      `Generated:\n\n${data.question_text}\n\nTime limit: ${data.time_limit_seconds}s`,
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12 min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 mb-8 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Job Postings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your active listings and candidate pipelines
          </p>
        </div>
        {!selectedJobId && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Create New Posting
          </button>
        )}
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
          <strong>Error:</strong> {fetchError}
        </div>
      )}

      {selectedJobId ? (
        /* Applicants view */
        <div className="space-y-6">
          <button
            onClick={() => {
              setSelectedJobId(null);
              setApplicants([]);
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to All Job Postings
          </button>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">
                Applicants for:{" "}
                <span className="text-indigo-600 font-medium">
                  {jobs.find((j) => j.id === selectedJobId)?.title}
                </span>
              </h2>
            </div>

            {loadingApplicants ? (
              <div className="py-16 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading applicants…
              </div>
            ) : applicants.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-400 text-sm">
                  No applications received yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {applicants.map((app) => (
                  <div
                    key={app.id}
                    className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/40 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <h3 className="font-semibold text-gray-900">
                        {app.applicant_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {app.applicant_email}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Applied {new Date(app.applied_at).toLocaleDateString()}
                        {app.match_score != null && (
                          <span className="ml-2 text-indigo-500 font-medium">
                            · {Math.round(app.match_score * 100)}% match
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {app.is_override && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Override
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {app.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Jobs board */
        <div className="space-y-4">
          {showForm && (
            <JobForm
              onCreated={(job) => {
                setJobs((prev) => [job, ...prev]);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {jobs.map((job) => (
            <div
              key={job.id}
              className="group bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                      {job.title}
                    </h2>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                    <span className="capitalize">
                      {job.location || "Remote"}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="capitalize">{job.work_mode || "—"}</span>
                    <span className="text-gray-300">·</span>
                    <span className="capitalize text-indigo-600 font-medium">
                      {job.job_level} level
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold">
                      {job.hiring_count} open position
                      {job.hiring_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleViewApplicants(job.id)}
                    className="inline-flex items-center gap-1.5 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl font-semibold transition-colors"
                  >
                    View Applicants
                  </button>
                  {job.status === "draft" && (
                    <button
                      onClick={() => handlePublish(job.id)}
                      className="text-xs bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      Publish
                    </button>
                  )}
                  {job.status === "published" && (
                    <>
                      <button
                        onClick={() => handleGenerateScenario(job.id)}
                        className="inline-flex items-center gap-1.5 text-xs bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 px-3.5 py-2 rounded-xl font-semibold transition-colors"
                      >
                        Generate scenario (test)
                      </button>
                      <button
                        onClick={() => handleReprocess(job.id)}
                        className="inline-flex items-center gap-1.5 text-xs bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-3.5 py-2 rounded-xl font-semibold transition-colors"
                      >
                        Re-analyze JD
                      </button>

                      <button
                        onClick={() => viewDetails(job.id)}
                        disabled={loadingDetail === job.id}
                        className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3.5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50"
                      >
                        {loadingDetail === job.id
                          ? "Loading…"
                          : "View analysis"}
                      </button>

                      <button
                        onClick={() => handleClose(job.id)}
                        className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 px-3.5 py-2 rounded-xl font-semibold transition-colors"
                      >
                        Close
                      </button>
                    </>
                  )}
                  {job.status === "closed" && (
                    <button
                      onClick={() => handlePublish(job.id)}
                      className="text-xs bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {jobs.length === 0 && !fetchError && (
            <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
              <p className="text-gray-500 font-medium">No job postings yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create your first posting to start hiring.
              </p>
            </div>
          )}
        </div>
      )}
      {detailFor && (
        <ExtractionDetailModal
          title={detailFor.title}
          categories={detailFor.categories}
          parsedData={detailFor.parsed_data}
          hasEmbedding={detailFor.has_embedding}
          onClose={() => setDetailFor(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || "draft";
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    published: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    closed: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span
      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border capitalize ${styles[s] ?? styles.draft}`}
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
    scenario_enabled: false,
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description are required.");
      return;
    }
    if (form.description.trim().length < 50) {
      setError("Description must be at least 50 characters.");
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
        setError(data?.detail || "Failed to create job.");
        return;
      }
      onCreated(data);
    } catch {
      setError("Network error. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border-2 border-indigo-100 rounded-2xl p-6 mb-8 shadow-sm space-y-5"
    >
      <div>
        <h2 className="text-xl font-bold text-gray-900">New Job Listing</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Define your position criteria and requirements
        </p>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
            Job Title
          </label>
          <input
            placeholder="e.g. Senior Software Engineer"
            value={form.title}
            required
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
            Job Description
          </label>
          <textarea
            placeholder="Describe the role, responsibilities, and requirements… (min 50 characters)"
            rows={5}
            value={form.description}
            required
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Location
            </label>
            <input
              placeholder="e.g. Bangalore, India"
              value={form.location}
              onChange={(e) =>
                setForm((p) => ({ ...p, location: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Work Mode
            </label>
            <select
              value={form.work_mode}
              onChange={(e) =>
                setForm((p) => ({ ...p, work_mode: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              <option value="remote">Remote</option>
              <option value="onsite">Onsite</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Level
            </label>
            <select
              value={form.job_level}
              onChange={(e) =>
                setForm((p) => ({ ...p, job_level: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              <option value="fresher">Fresher</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Headcount
            </label>
            <input
              type="number"
              min={1}
              value={form.hiring_count}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  hiring_count: Math.max(1, Number(e.target.value)),
                }))
              }
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
      <div className="pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.scenario_enabled}
            onChange={(e) =>
              setForm((p) => ({ ...p, scenario_enabled: e.target.checked }))
            }
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">
            Include a scenario-based question for candidates
          </span>
        </label>
        <p className="text-xs text-gray-400 mt-1 ml-6">
          You'll generate the actual question after publishing, once the JD has
          been analyzed.
        </p>
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
