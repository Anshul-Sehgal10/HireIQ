"use client";

import { useEffect, useState } from "react";
import { Plus, ArrowLeft, Inbox, ChevronRight } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import EmployerJobDetailModal from "@/components/EmployerJobDetailModal";
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  StatusBadge,
  SkeletonCard,
  SkeletonText,
  useToast,
} from "@/components/ui";

interface Job {
  id: string;
  title: string;
  status: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  hiring_count: number;
  scenario_enabled: boolean;
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
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null); // full-page applicants view
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const [detailJobId, setDetailJobId] = useState<string | null>(null); // card-click modal

  useEffect(() => {
    apiFetch("/jobs/mine")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || "Failed to retrieve jobs.");
        if (Array.isArray(data)) {
          setJobs(data);
          setFetchError(null);
        } else setFetchError("Unexpected response from server.");
      })
      .catch((err) => setFetchError(err.message || "A network error occurred."))
      .finally(() => setLoading(false));
  }, []);

  const handlePublish = async (id: string) => {
    const res = await apiFetch(`/jobs/${id}/publish`, { method: "POST" });
    if (res.ok) {
      const updated: Job = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updated } : j)));
      toast({ title: "Job published", variant: "success" });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Failed to publish job", description: d.detail, variant: "error" });
    }
  };

  const handleReprocess = async (id: string) => {
    const res = await apiFetch(`/jobs/${id}/reprocess`, { method: "POST" });
    if (res.ok) {
      const updated: Job = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updated } : j)));
      toast({ title: "Job description re-analyzed", variant: "success" });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Failed to reprocess job description", description: d.detail, variant: "error" });
    }
  };

  const handleClose = async (id: string) => {
    const res = await apiFetch(`/jobs/${id}/close`, { method: "POST" });
    if (res.ok) {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "closed" } : j)));
      toast({ title: "Job closed", variant: "success" });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Failed to close job", description: d.detail, variant: "error" });
    }
  };

  const handleViewApplicants = async (jobId: string) => {
    setDetailJobId(null);
    setSelectedJobId(jobId);
    setLoadingApplicants(true);
    try {
      const res = await apiFetch(`/applications/job/${jobId}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) setApplicants(data);
      else toast({ title: "Failed to load applicants", description: data?.detail, variant: "error" });
    } finally {
      setLoadingApplicants(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Job postings"
        description="Manage your active listings and candidate pipelines"
        actions={
          !selectedJobId && (
            <Button leftIcon={<Plus size={15} />} onClick={() => setShowForm(true)}>
              Create posting
            </Button>
          )
        }
      />

      <div className="space-y-4 p-6">
        {fetchError && (
          <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
            <strong>Error:</strong> {fetchError}
          </div>
        )}

        {selectedJobId ? (
          <div className="space-y-6">
            <button
              onClick={() => { setSelectedJobId(null); setApplicants([]); }}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft size={15} />
              Back to all job postings
            </button>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-border bg-muted/40 px-6 py-5">
                <h2 className="text-lg font-bold text-foreground">
                  Applicants for:{" "}
                  <span className="font-medium text-primary">
                    {jobs.find((j) => j.id === selectedJobId)?.title}
                  </span>
                </h2>
              </div>

              {loadingApplicants ? (
                <div className="space-y-3 p-6">
                  <SkeletonText lines={4} />
                </div>
              ) : applicants.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Inbox size={18} />
                  </div>
                  <p className="text-sm text-muted-foreground">No applications received yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {applicants.map((app) => (
                    <div
                      key={app.id}
                      className="flex flex-col items-start justify-between gap-4 p-6 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-0.5">
                        <h3 className="font-semibold text-foreground">{app.applicant_name}</h3>
                        <p className="text-sm text-muted-foreground">{app.applicant_email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Applied {new Date(app.applied_at).toLocaleDateString()}
                          {app.match_score != null && (
                            <span className="ml-2 font-medium text-primary">
                              · {Math.round(app.match_score * 100)}% match
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {app.is_override && (
                          <span className="rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs text-warning-foreground">
                            Override
                          </span>
                        )}
                        <StatusBadge status={app.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {showForm && (
              <JobForm
                onCreated={(job) => { setJobs((prev) => [job, ...prev]); setShowForm(false); }}
                onCancel={() => setShowForm(false)}
                toast={toast}
              />
            )}

            {loading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {!loading &&
              jobs.map((job) => (
                <Card
                  key={job.id}
                  interactive
                  onClick={() => setDetailJobId(job.id)}
                  className="p-5"
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="text-lg font-bold tracking-tight text-foreground">
                            {job.title}
                          </h2>
                          <StatusBadge status={job.status} />
                          {job.scenario_enabled && (
                            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                              Scenario question
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{job.location || "Remote"}</span>
                          <span className="text-border">·</span>
                          <span className="capitalize">{job.work_mode || "—"}</span>
                          <span className="text-border">·</span>
                          <span className="font-medium capitalize text-primary">
                            {job.job_level} level
                          </span>
                          <span className="text-border">·</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                            {job.hiring_count} open position{job.hiring_count !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/70 transition-colors group-hover:text-foreground">
                        Click to view <ChevronRight size={13} />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}

            {!loading && jobs.length === 0 && !fetchError && (
              <Card className="p-14 text-center">
                <CardContent className="p-0">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Inbox size={18} />
                  </div>
                  <p className="font-medium text-foreground">No job postings yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first posting to start hiring.
                  </p>
                  <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                    Create posting
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {detailJobId && (
        <EmployerJobDetailModal
          jobId={detailJobId}
          onClose={() => setDetailJobId(null)}
          onPublish={handlePublish}
          onCloseJob={handleClose}
          onReprocess={handleReprocess}
          onViewApplicants={handleViewApplicants}
        />
      )}
    </div>
  );
}

function JobForm({
  onCreated,
  onCancel,
  toast,
}: {
  onCreated: (j: Job) => void;
  onCancel: () => void;
  toast: (opts: { title: string; description?: string; variant?: "success" | "error" | "info" }) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    work_mode: "",
    job_level: "",
    hiring_count: 1,
    salary_min: "",
    salary_max: "",
    scenario_enabled: false,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

    const salary_min = form.salary_min.trim() ? Number(form.salary_min) : null;
    const salary_max = form.salary_max.trim() ? Number(form.salary_max) : null;
    if (salary_min != null && salary_max != null && salary_min > salary_max) {
      setError("Minimum salary can't be greater than maximum salary.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/jobs/", {
        method: "POST",
        body: JSON.stringify({ ...form, salary_min, salary_max }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail || "Failed to create job.");
        return;
      }
      toast({ title: "Job posting created", variant: "success" });
      onCreated(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <CardContent className="space-y-5 p-0">
        <div>
          <h2 className="text-xl font-bold text-foreground">New job listing</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Define your position criteria and requirements
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-2.5 text-xs font-medium text-danger-foreground">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Job title" htmlFor="title" required>
            <Input
              id="title"
              placeholder="e.g. Senior Software Engineer"
              value={form.title}
              required
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </Field>

          <Field
            label="Job description"
            htmlFor="description"
            required
            hint="Minimum 50 characters."
          >
            <Textarea
              id="description"
              placeholder="Describe the role, responsibilities, and requirements…"
              rows={5}
              value={form.description}
              required
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Field label="Location" htmlFor="location">
              <Input
                id="location"
                placeholder="e.g. Bangalore, India"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              />
            </Field>
            <Field label="Work mode" htmlFor="work_mode">
              <Select
                id="work_mode"
                value={form.work_mode}
                onChange={(e) => setForm((p) => ({ ...p, work_mode: e.target.value }))}
              >
                <option value="">Select</option>
                <option value="remote">Remote</option>
                <option value="onsite">Onsite</option>
                <option value="hybrid">Hybrid</option>
              </Select>
            </Field>
            <Field label="Level" htmlFor="job_level">
              <Select
                id="job_level"
                value={form.job_level}
                onChange={(e) => setForm((p) => ({ ...p, job_level: e.target.value }))}
              >
                <option value="">Select</option>
                <option value="fresher">Fresher</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
              </Select>
            </Field>
            <Field label="Headcount" htmlFor="hiring_count">
              <Input
                id="hiring_count"
                type="number"
                min={1}
                value={form.hiring_count}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hiring_count: Math.max(1, Number(e.target.value)) }))
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Salary min" htmlFor="salary_min" hint="Optional, ₹/yr">
              <Input
                id="salary_min"
                type="number"
                min={0}
                placeholder="e.g. 800000"
                value={form.salary_min}
                onChange={(e) => setForm((p) => ({ ...p, salary_min: e.target.value }))}
              />
            </Field>
            <Field label="Salary max" htmlFor="salary_max" hint="Optional, ₹/yr">
              <Input
                id="salary_max"
                type="number"
                min={0}
                placeholder="e.g. 1500000"
                value={form.salary_max}
                onChange={(e) => setForm((p) => ({ ...p, salary_max: e.target.value }))}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3.5">
            <input
              type="checkbox"
              checked={form.scenario_enabled}
              onChange={(e) => setForm((p) => ({ ...p, scenario_enabled: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
            />
            <span>
              <span className="block text-sm text-foreground">
                Include a scenario-based question for candidates
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                The question is generated automatically the first time a candidate applies — you
                won't see it in advance.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save posting
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}