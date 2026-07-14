"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
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

interface ScenarioQuestion {
  id: string;
  question_text: string;
  time_limit_seconds: number;
  generated_at: string;
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
  jobId, onClose, onPublish, onCloseJob, onReprocess, onViewApplicants,
}: Props) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [scenario, setScenario] = useState<ScenarioQuestion | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<{ categories: string[] | null; parsed_data: Record<string, any> | null; has_embedding: boolean } | null>(null);
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

  const loadScenario = async () => {
    setScenarioLoading(true);
    try {
      const res = await apiFetch(`/jobs/${jobId}/scenario`);
      if (res.ok) setScenario(await res.json());
      else setScenario(null);
    } finally {
      setScenarioLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    loadScenario();
  }, [jobId]);

  const handleGenerateScenario = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch(`/jobs/${jobId}/scenario/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Scenario generation failed");
      setScenario(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  };

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
      await loadDetail(); // status/categories may have changed
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        {loading && <p className="text-sm text-gray-400 animate-pulse">Loading…</p>}
        {loadError && <p className="text-sm text-red-500">{loadError}</p>}

        {detail && (
          <>
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-lg font-bold text-gray-900">{detail.title}</h2>
              <StatusBadge status={detail.status} />
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {[detail.location, detail.work_mode, detail.job_level].filter(Boolean).join(" · ")}
              {" · "}{detail.hiring_count} open position{detail.hiring_count !== 1 ? "s" : ""}
            </p>

            {(detail.salary_min || detail.salary_max) && (
              <p className="text-sm text-gray-500 mb-3">
                {detail.salary_min && detail.salary_max
                  ? `₹${detail.salary_min.toLocaleString()} – ₹${detail.salary_max.toLocaleString()}`
                  : detail.salary_min ? `From ₹${detail.salary_min.toLocaleString()}` : `Up to ₹${detail.salary_max!.toLocaleString()}`}
              </p>
            )}

            {detail.categories && detail.categories.length > 0 && (
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {detail.categories.map((c) => (
                  <span key={c} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full capitalize">
                    {c.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 mb-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.description}</p>
            </div>

            {/* Scenario section */}
            <div className="border-t border-gray-100 pt-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scenario question</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  detail.scenario_enabled ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {detail.scenario_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              {detail.scenario_enabled && (
                <>
                  {scenarioLoading ? (
                    <p className="text-xs text-gray-400 animate-pulse">Checking for a question…</p>
                  ) : scenario ? (
                    <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 mb-2">
                      <p className="text-sm text-gray-800">{scenario.question_text}</p>
                      <p className="text-xs text-gray-500 mt-1.5">Time limit: {scenario.time_limit_seconds}s</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-2">No question generated yet.</p>
                  )}
                  <button
                    onClick={handleGenerateScenario}
                    disabled={generating}
                    className="text-xs bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {generating ? "Generating…" : scenario ? "Regenerate question" : "Generate question"}
                  </button>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-2">
              <button
                onClick={() => onViewApplicants(detail.id)}
                className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl font-semibold transition-colors"
              >
                View Applicants
              </button>

              {detail.status === "draft" && (
                <button
                  onClick={() => runAction(() => onPublish(detail.id))}
                  disabled={actionBusy}
                  className="text-xs bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {actionBusy ? "Publishing…" : "Publish"}
                </button>
              )}

              {detail.status === "published" && (
                <>
                  <button
                    onClick={() => runAction(() => onReprocess(detail.id))}
                    disabled={actionBusy}
                    className="text-xs bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-3.5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    Re-analyze JD
                  </button>
                  <button
                    onClick={loadAnalysis}
                    disabled={analysisLoading}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3.5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    {analysisLoading ? "Loading…" : "View analysis"}
                  </button>
                  <button
                    onClick={() => runAction(() => onCloseJob(detail.id))}
                    disabled={actionBusy}
                    className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 px-3.5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    Close
                  </button>
                </>
              )}

              {detail.status === "closed" && (
                <button
                  onClick={() => runAction(() => onPublish(detail.id))}
                  disabled={actionBusy}
                  className="text-xs bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </div>
          </>
        )}

        <button onClick={onClose} className="mt-4 text-xs text-gray-400 hover:text-gray-600 w-full text-center">Close</button>
      </div>

      {showAnalysis && analysis && (
        <ExtractionDetailModal
          title={detail?.title ?? "Job analysis"}
          categories={analysis.categories}
          parsedData={analysis.parsed_data}
          hasEmbedding={analysis.has_embedding}
          onClose={() => setShowAnalysis(false)}
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
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border capitalize ${styles[s] ?? styles.draft}`}>
      {status}
    </span>
  );
}