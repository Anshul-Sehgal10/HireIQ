// frontend/components/JobDetailModal.tsx
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface JobDetail {
  id: string;
  title: string;
  description: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  categories?: string[] | null;
  scenario_enabled: boolean;
  org_name: string;
  org_domain: string | null;
  org_verification_status: string;
}

interface ResumeVersion {
  id: string;
  version_number: number;
  label: string | null;
  is_current: boolean;
}

interface RelevanceResult {
  resume_version_id: string;
  match_score: number | null;
  match_threshold: number;
  meets_threshold: boolean;
}

interface Props {
  jobId: string;
  resumeVersions: ResumeVersion[];
  alreadyApplied: boolean;
  onClose: () => void;
  onApplied: (application: {
    id: string;
    job_id: string;
    status: string;
  }) => void;
}

interface ScenarioPreview {
  question_text: string;
  time_limit_seconds: number;
}

export default function JobDetailModal({
  jobId,
  resumeVersions,
  alreadyApplied,
  onClose,
  onApplied,
}: Props) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedResumeId, setSelectedResumeId] = useState(
    resumeVersions.find((r) => r.is_current)?.id ?? resumeVersions[0]?.id ?? "",
  );
  const [relevance, setRelevance] = useState<RelevanceResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [overridesRemaining, setOverridesRemaining] = useState<number | null>(
    null,
  );

  const [scenario, setScenario] = useState<ScenarioPreview | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [showScenario, setShowScenario] = useState(false);

  useEffect(() => {
    if (!detail?.scenario_enabled) return;
    setScenarioLoading(true);
    apiFetch(`/jobs/${jobId}/scenario/preview`)
      .then(async (res) => setScenario(res.ok ? await res.json() : null))
      .finally(() => setScenarioLoading(false));
  }, [detail?.scenario_enabled, jobId]);

  useEffect(() => {
    (async () => {
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
    })();
  }, [jobId]);

  const checkRelevance = async () => {
    if (!selectedResumeId) return;
    setChecking(true);
    setRelevance(null);
    setApplyError(null);
    try {
      const res = await apiFetch(
        `/jobs/${jobId}/relevance?resume_version_id=${selectedResumeId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to check relevance");
      setRelevance(data);
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const submitApply = async (override: boolean) => {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await apiFetch("/applications/", {
        method: "POST",
        body: JSON.stringify({
          job_id: jobId,
          resume_version_id: selectedResumeId,
          override,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.detail?.code === "low_match") {
          setOverridesRemaining(data.detail.overrides_remaining ?? null);
          setApplyError(data.detail.message);
          return;
        }
        throw new Error(
          data.detail?.message ?? data.detail ?? "Failed to apply",
        );
      }
      onApplied({
        id: data.id,
        job_id: jobId,
        status: data.status ?? "pending",
      });
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        {loading && (
          <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
        )}
        {loadError && <p className="text-sm text-red-500">{loadError}</p>}

        {detail && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {detail.title}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{detail.org_name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                    detail.org_verification_status === "verified"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {detail.org_verification_status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {[detail.location, detail.work_mode, detail.job_level]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {(detail.salary_min || detail.salary_max) && (
                <p className="text-sm text-gray-500 mt-1">
                  {detail.salary_min && detail.salary_max
                    ? `₹${detail.salary_min.toLocaleString()} – ₹${detail.salary_max.toLocaleString()}`
                    : detail.salary_min
                      ? `From ₹${detail.salary_min.toLocaleString()}`
                      : `Up to ₹${detail.salary_max!.toLocaleString()}`}
                </p>
              )}
              {detail.categories && detail.categories.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {detail.categories.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full capitalize"
                    >
                      {c.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 mb-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {detail.description}
              </p>
            </div>

            {detail.scenario_enabled && (
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                    Includes a scenario question
                  </p>
                  {scenario && (
                    <button
                      onClick={() => setShowScenario((v) => !v)}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      {showScenario ? "Hide" : "Preview question"}
                    </button>
                  )}
                </div>
                {scenarioLoading && (
                  <p className="text-xs text-gray-400 mt-1 animate-pulse">
                    Loading…
                  </p>
                )}
                {!scenarioLoading && !scenario && (
                  <p className="text-xs text-gray-400 mt-1">
                    This role includes a scenario question — the employer hasn't
                    published it yet.
                  </p>
                )}
                {showScenario && scenario && (
                  <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 mt-2">
                    <p className="text-sm text-gray-800">
                      {scenario.question_text}
                    </p>
                    <p className="text-xs text-gray-500 mt-1.5">
                      You'll have {scenario.time_limit_seconds} seconds to
                      answer.
                    </p>
                  </div>
                )}
              </div>
            )}

            {alreadyApplied ? (
              <p className="text-sm text-emerald-600 font-medium">
                You've already applied to this job.
              </p>
            ) : (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Resume to use
                  </label>
                  <select
                    value={selectedResumeId}
                    onChange={(e) => {
                      setSelectedResumeId(e.target.value);
                      setRelevance(null);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {resumeVersions.map((rv) => (
                      <option key={rv.id} value={rv.id}>
                        {rv.label ?? `Version ${rv.version_number}`}
                        {rv.is_current ? " (active)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {!relevance && (
                  <button
                    onClick={checkRelevance}
                    disabled={checking || !selectedResumeId}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {checking ? "Checking…" : "Check relevance"}
                  </button>
                )}

                {relevance && (
                  <div
                    className={`rounded-lg p-4 border ${relevance.meets_threshold ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}
                  >
                    <p
                      className={`text-sm font-medium ${relevance.meets_threshold ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {relevance.match_score != null
                        ? `${Math.round(relevance.match_score * 100)}% match`
                        : "Match score not available yet"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {relevance.meets_threshold
                        ? "This looks like a strong match for your profile."
                        : "Your profile is not a strong match for this role based on your skills and experience."}
                    </p>
                  </div>
                )}

                {applyError && (
                  <p className="text-sm text-red-500">{applyError}</p>
                )}

                {relevance && (
                  <button
                    onClick={() => submitApply(!relevance.meets_threshold)}
                    disabled={applying}
                    className={`w-full text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 ${
                      relevance.meets_threshold
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-amber-600 hover:bg-amber-500"
                    }`}
                  >
                    {applying
                      ? "Submitting…"
                      : relevance.meets_threshold
                        ? "Apply"
                        : `Apply anyway${overridesRemaining != null ? ` (${overridesRemaining} left)` : ""}`}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 w-full text-center"
        >
          Close
        </button>
      </div>
    </div>
  );
}
