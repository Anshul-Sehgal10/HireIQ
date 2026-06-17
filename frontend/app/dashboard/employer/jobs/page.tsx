"use client";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
interface Job {
  id: string;
  title: string;
  status: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  hiring_count: number;
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("access_token");
  return fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
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

  useEffect(() => {
    apiFetch("/jobs/mine").then(r => r.json()).then(setJobs);
  }, []);

  const handlePublish = async (id: string) => {
    await apiFetch(`/jobs/${id}/publish`, { method: "POST" });
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "published" } : j));
  };

  const handleClose = async (id: string) => {
    await apiFetch(`/jobs/${id}/close`, { method: "POST" });
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "closed" } : j));
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Job postings</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          New posting
        </button>
      </div>

      {showForm && (
        <JobForm
          onCreated={(job) => { setJobs(prev => [job, ...prev]); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {jobs.map(job => (
          <div key={job.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-medium text-gray-900">{job.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {[job.location, job.work_mode, job.job_level].filter(Boolean).join(" · ")}
                  {" · "}{job.hiring_count} hire{job.hiring_count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={job.status} />
                {job.status === "draft" && (
                  <button onClick={() => handlePublish(job.id)}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                    Publish
                  </button>
                )}
                {job.status === "published" && (
                  <button onClick={() => handleClose(job.id)}
                    className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300">
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-12">No job postings yet.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft:     "bg-gray-100 text-gray-600",
    published: "bg-green-100 text-green-700",
    paused:    "bg-yellow-100 text-yellow-700",
    closed:    "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

function JobForm({ onCreated, onCancel }: { onCreated: (j: Job) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", location: "", work_mode: "", job_level: "", hiring_count: 1 });
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.title || !form.description) { setError("Title and description are required"); return; }
    const res = await apiFetch("/jobs/", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (!res.ok) { setError("Failed to create job"); return; }
    onCreated(await res.json());
  };

  return (
    <div className="border border-blue-200 rounded-lg p-6 mb-6 bg-blue-50">
      <h2 className="font-medium text-gray-900 mb-4">New job posting</h2>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="space-y-3">
        <input placeholder="Job title" value={form.title}
          onChange={e => setForm(p => ({...p, title: e.target.value}))}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        <textarea placeholder="Job description (min 50 chars)" rows={6} value={form.description}
          onChange={e => setForm(p => ({...p, description: e.target.value}))}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        <div className="grid grid-cols-3 gap-3">
          <input placeholder="Location" value={form.location}
            onChange={e => setForm(p => ({...p, location: e.target.value}))}
            className="border border-gray-300 rounded px-3 py-2 text-sm" />
          <select value={form.work_mode} onChange={e => setForm(p => ({...p, work_mode: e.target.value}))}
            className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">Work mode</option>
            <option value="remote">Remote</option>
            <option value="onsite">Onsite</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select value={form.job_level} onChange={e => setForm(p => ({...p, job_level: e.target.value}))}
            className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">Level</option>
            <option value="fresher">Fresher</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          Save as draft
        </button>
        <button onClick={onCancel} className="text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </div>
  );
}