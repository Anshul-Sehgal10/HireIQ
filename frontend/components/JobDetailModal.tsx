"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Briefcase, Sparkles, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SlideOver, Button, Badge, StatusBadge, Skeleton, SkeletonText } from "@/components/ui";

interface JobPreview {
  id: string;
  title: string;
  description: string;
  role_summary?: string | null;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  org_name: string;
  scenario_enabled: boolean;
}

interface ApplicationSummary {
  id: string;
  status: string;
  match_score: number | null;
}

interface Props {
  jobId: string;
  application?: ApplicationSummary;
  onClose: () => void;
}

function formatSalary(min: number | null, max: number | null) {
  const fmt = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : `₹${n.toLocaleString()}`);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function truncate(text: string, max: number) {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/**
 * Quick-look preview only — no apply/relevance/withdraw logic lives here
 * anymore. The single CTA (in the SlideOver's fixed footer, so it's never
 * pushed below a scroll) takes the candidate to the full job detail page,
 * where the apply flow has room to breathe.
 */
export default function JobDetailModal({ jobId, application, onClose }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<JobPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/jobs/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Failed to load job");
        setJob(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const goToDetails = () => router.push(`/candidate/jobs/${jobId}`);

  return (
    <SlideOver
      open
      onClose={onClose}
      title={loading ? "Loading…" : job?.title}
      width="md"
      footer={
        <Button className="w-full" rightIcon={<ArrowRight size={14} />} onClick={goToDetails}>
          {application ? "View application" : "View details & apply"}
        </Button>
      }
    >
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <SkeletonText lines={3} />
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {job && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{job.org_name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {job.location}
                </span>
              )}
              {job.work_mode && (
                <span className="flex items-center gap-1 capitalize">
                  <Briefcase size={12} /> {job.work_mode}
                </span>
              )}
              {job.job_level && <span className="capitalize">{job.job_level} level</span>}
            </div>
            {(job.salary_min || job.salary_max) && (
              <p className="mt-2 text-sm font-medium text-foreground">{formatSalary(job.salary_min, job.salary_max)}</p>
            )}
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {job.role_summary?.trim() || truncate(job.description, 220)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {job.scenario_enabled && (
              <Badge variant="primary">
                <Sparkles size={11} /> Scenario question
              </Badge>
            )}
            {application && <StatusBadge status={application.status} />}
          </div>

          {application?.match_score != null && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Resume match</span>
              <span className="font-medium text-foreground">{Math.round(application.match_score * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}