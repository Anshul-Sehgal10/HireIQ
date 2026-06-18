"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiUrl } from "@/lib/api";

interface Job {
  id: string;
  title: string;
  status: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  hiring_count: number;
}

// Global configuration wrapper matching FastAPI endpoint path architecture
function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("access_token");
  return fetch(apiUrl(path), {
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
    // Re-integrated RoleGuard to enforce client-side UI permission locks
    <RoleGuard allowed={["employer", "admin"]}>
      <JobsContent />
    </RoleGuard>
  );
}

function JobsContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    // Aligns precisely with: @router.get("/mine")
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
        setFetchError(err.message || "A routing or network connection error occurred.");
      });
  }, []);

  // Aligns precisely with: @router.post("/{job_id}/publish")
  const handlePublish = async (id: string) => {
    try {
      const res = await apiFetch(`/jobs/${id}/publish`, { method: "POST" });
      if (res.ok) {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "published" } : j));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Failed to publish job.");
      }
    } catch (err) {
      alert("Network error. Could not complete request.");
    }
  };

  // Aligns precisely with: @router.post("/{job_id}/close")
  const handleClose = async (id: string) => {
    try {
      const res = await apiFetch(`/jobs/${id}/close`, { method: "POST" });
      if (res.ok) {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "closed" } : j));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Failed to close job.");
      }
    } catch (err) {
      alert("Network error. Could not complete request.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Job Postings</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          New Posting
        </button>
      </div>

      {showForm && (
        <JobForm
          onCreated={(job) => { 
            setJobs(prev => Array.isArray(prev) ? [job, ...prev] : [job]); 
            setShowForm(false); 
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          <strong>Error:</strong> {fetchError}
        </div>
      )}

      <div className="space-y-3">
        {Array.isArray(jobs) && jobs.map(job => (
          <div key={job.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
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
                
                {/* Check matches case returned by Python enum values */}
                {job.status?.toLowerCase() === "draft" && (
                  <button onClick={() => handlePublish(job.id)}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors">
                    Publish
                  </button>
                )}
                {job.status?.toLowerCase() === "published" && (
                  <button onClick={() => handleClose(job.id)}
                    className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 transition-colors">
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {(!jobs || jobs.length === 0) && !fetchError && (
          <p className="text-gray-400 text-sm text-center py-12">No job postings found yet for this organization.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase() || 'draft';
  const styles: Record<string, string> = {
    draft:     "bg-gray-100 text-gray-600",
    published: "bg-green-100 text-green-700",
    paused:    "bg-yellow-100 text-yellow-700",
    closed:    "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${styles[normalized] ?? styles.draft}`}>
      {status}
    </span>
  );
}

function JobForm({ onCreated, onCancel }: { onCreated: (j: Job) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    location: "", 
    work_mode: "", 
    job_level: "", 
    hiring_count: 1 
  });
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.title || !form.description) { 
      setError("Title and description are required fields."); 
      return; 
    }
    setError("");
    
    try {
      // Aligns precisely with: @router.post("/")
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
    <div className="border border-blue-200 rounded-lg p-6 mb-6 bg-blue-50">
      <h2 className="font-medium text-gray-900 mb-4">New Job Posting</h2>
      {error && <p className="text-red-600 text-sm mb-3 font-medium">{error}</p>}
      <div className="space-y-3">
        <input placeholder="Job title" value={form.title}
          onChange={e => setForm(p => ({...p, title: e.target.value}))}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white" />
        <textarea placeholder="Job description" rows={4} value={form.description}
          onChange={e => setForm(p => ({...p, description: e.target.value}))}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white" />
        <div className="grid grid-cols-3 gap-3">
          <input placeholder="Location" value={form.location}
            onChange={e => setForm(p => ({...p, location: e.target.value}))}
            className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white" />
          <select value={form.work_mode} onChange={e => setForm(p => ({...p, work_mode: e.target.value}))}
            className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white">
            <option value="">Work mode</option>
            <option value="remote">Remote</option>
            <option value="onsite">Onsite</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select value={form.job_level} onChange={e => setForm(p => ({...p, job_level: e.target.value}))}
            className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white">
            <option value="">Level</option>
            <option value="fresher">Fresher</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors">
          Save Posting
        </button>
        <button onClick={onCancel} className="text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-200 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}