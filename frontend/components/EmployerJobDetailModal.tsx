"use client";

import { useEffect, useState } from "react";
import { Briefcase, MapPin, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  SlideOver,
  Button,
  StatusBadge,
  Skeleton,
  SkeletonText,
} from "@/components/ui";
import ExtractionDetailModal from "@/components/ExtractionDetailModal";

interface JobDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  hiring_count: number;
  scenario_enabled: boolean;
  categories?: string[] | null;
}

interface Props {
  jobId: string;
  onClose: () => void;
  onPublish: (id: string) => Promise<void>;
  onCloseJob: (id: string) => Promise<void>;
  onReprocess: (id: string) => Promise<void>;
  onViewApplicants: (id: string) => void;
}

export default function EmployerJobDetailModal({
  jobId,
  onClose,
  onPublish,
  onCloseJob,
  onReprocess,
  onViewApplicants,
}: Props) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<{
    categories: string[] | null;
    parsed_data: Record<string, any> | null;
    has_embedding: boolean;
  } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const loadDetail = async () => {
    try {
      const res = await apiFetch(`/jobs/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to load job");
      setDetail(data);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [jobId]);

  const loadAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await apiFetch(`/jobs/${jobId}/details`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to load analysis");
      setAnalysis(data);
      setShowAnalysis(true);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const runAction = async (fn: () => Promise<void>) => {
    setActionBusy(true);
    try {
      await fn();
      await loadDetail();
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      <SlideOver
        open
        onClose={onClose}
        title={loading ? "Loading…" : detail?.title}
        width="lg"
      >
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/3" />
            <SkeletonText lines={4} />
          </div>
        )}
        {loadError && <p className="text-sm text-danger">{loadError}</p>}

        {detail && (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StatusBadge status={detail.status} />
                {detail.scenario_enabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    <Sparkles size={11} /> Scenario question
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {detail.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} /> {detail.location}
                  </span>
                )}
                {detail.work_mode && (
                  <span className="capitalize flex items-center gap-1.5">
                    <Briefcase size={13} /> {detail.work_mode}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users size={13} /> {detail.hiring_count} open position
                  {detail.hiring_count !== 1 ? "s" : ""}
                </span>
              </div>
              {(detail.salary_min || detail.salary_max) && (
                <p className="mt-2 text-sm font-medium text-foreground">
                  {detail.salary_min && detail.salary_max
                    ? `₹${detail.salary_min.toLocaleString()} – ₹${detail.salary_max.toLocaleString()}`
                    : detail.salary_min
                      ? `From ₹${detail.salary_min.toLocaleString()}`
                      : `Up to ₹${detail.salary_max!.toLocaleString()}`}
                </p>
              )}
              {detail.categories && detail.categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {detail.categories.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary"
                    >
                      {c.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {detail.description}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Scenario question
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    detail.scenario_enabled
                      ? "bg-success-bg text-success-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {detail.scenario_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              {detail.scenario_enabled && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Generated automatically for the first applicant — content
                  isn't shown here to keep it consistent across candidates.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewApplicants(detail.id)}
              >
                View applicants
              </Button>

              <Link href={`/employer/jobs/${detail.id}/pipeline`}>
                <Button variant="outline" size="sm">
                  Pipeline
                </Button>
              </Link>

              {detail.status === "draft" && (
                <Button
                  size="sm"
                  loading={actionBusy}
                  onClick={() => runAction(() => onPublish(detail.id))}
                >
                  Publish
                </Button>
              )}

              {detail.status === "published" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={actionBusy}
                    onClick={() => runAction(() => onReprocess(detail.id))}
                  >
                    Re-analyze JD
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={analysisLoading}
                    onClick={loadAnalysis}
                  >
                    View analysis
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    loading={actionBusy}
                    onClick={() => runAction(() => onCloseJob(detail.id))}
                  >
                    Close
                  </Button>
                </>
              )}

              {detail.status === "closed" && (
                <Button
                  size="sm"
                  loading={actionBusy}
                  onClick={() => runAction(() => onPublish(detail.id))}
                >
                  Reopen
                </Button>
              )}
            </div>
          </div>
        )}
      </SlideOver>

      {showAnalysis && analysis && (
        <ExtractionDetailModal
          title={detail?.title ?? "Job analysis"}
          categories={analysis.categories}
          parsedData={analysis.parsed_data}
          hasEmbedding={analysis.has_embedding}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </>
  );
}
