"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";

interface Overview {
  has_resume: boolean;
  resume_categories: string[] | null;
  subscription_tier: string;
  override_apps_used: number;
  override_apps_limit: number;
  overrides_remaining: number;
  total_applications: number;
  status_counts: Record<string, number>;
  overrides_unlimited: boolean;
}

interface ApplicationRow {
  id: string;
  job_id: string;
  status: string;
  match_score: number | null;
  is_override: boolean;
  applied_at: string;
  job_title: string;
  org_name: string;
  scenario_enabled: boolean;
  scenario_score: number | null;
  scenario_ai_summary: string | null;
  scenario_meets_threshold: boolean | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  resume_rejected: "Below match bar",
  resume_passed: "Resume passed",
  scenario_pending: "Scenario in progress",
  scenario_submitted: "Scenario submitted",
  shortlisted: "Shortlisted",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export default function CandidateDashboardPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <DashboardContent />
    </RoleGuard>
  );
}

function DashboardContent() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, appsRes] = await Promise.all([
        apiFetch("/candidates/me/overview"),
        apiFetch("/applications/mine"),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (appsRes.ok) {
        const data = await appsRes.json();
        setApplications(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const useOverride = async (applicationId: string) => {
    setBusyId(applicationId);
    try {
      const res = await apiFetch(`/applications/${applicationId}/scenario/override`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to apply override");
      }
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (applicationId: string) => {
    if (!confirm("Withdraw this application? This can't be undone.")) return;
    setBusyId(applicationId);
    try {
      const res = await apiFetch(`/applications/${applicationId}/withdraw`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to withdraw");
      }
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-gray-400 text-sm animate-pulse">Loading dashboard…</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <Link href="/candidate/jobs" className="text-sm text-blue-600 hover:text-blue-700">
          Browse jobs →
        </Link>
      </div>

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Applications" value={overview.total_applications} />
          <StatCard
            label="Shortlisted"
            value={overview.status_counts["shortlisted"] ?? 0}
          />
          <StatCard
            label="In progress"
            value={
              (overview.status_counts["scenario_pending"] ?? 0) +
              (overview.status_counts["resume_passed"] ?? 0) +
              (overview.status_counts["scenario_submitted"] ?? 0)
            }
          />
          <StatCard
            label="Overrides left"
            value={
              overview.overrides_unlimited
                ? "Unlimited"
                : `${overview.overrides_remaining}/${overview.override_apps_limit}`
            }
          />
        </div>
      )}

      {overview && !overview.has_resume && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          You haven't uploaded a resume yet.{" "}
          <Link href="/candidate/resumes" className="underline font-medium">
            Upload one
          </Link>{" "}
          to start applying.
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Your applications</h2>

        {applications.length === 0 && (
          <p className="text-gray-400 text-sm py-8 text-center">
            You haven't applied to any jobs yet.
          </p>
        )}

        <div className="space-y-3">
          {applications.map((app) => (
            <div
              key={app.id}
              className="border border-gray-200 rounded-xl p-4 bg-white flex flex-col gap-2"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="font-medium text-gray-900">{app.job_title}</p>
                  <p className="text-xs text-gray-500">{app.org_name}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 shrink-0">
                  {STATUS_LABELS[app.status] ?? app.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                {app.match_score != null && (
                  <span>Resume match: {Math.round(app.match_score * 100)}%</span>
                )}
                {app.scenario_enabled && app.scenario_score != null && (
                  <span>
                    Scenario score: {Math.round(app.scenario_score * 100)}%
                    {app.scenario_meets_threshold === false && " (below bar)"}
                  </span>
                )}
                {app.is_override && <span className="text-amber-600">Used override</span>}
                <span>Applied {new Date(app.applied_at).toLocaleDateString()}</span>
              </div>

              {app.scenario_ai_summary && (
                <p className="text-xs text-gray-600 mt-1">{app.scenario_ai_summary}</p>
              )}

              {app.status === "scenario_pending" && app.scenario_meets_threshold === false && (
                <div className="flex gap-2 mt-2">
                  {overview && overview.overrides_remaining > 0 ? (
                    <button
                      onClick={() => useOverride(app.id)}
                      disabled={busyId === app.id}
                      className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      {busyId === app.id ? "Submitting…" : "Use override & submit"}
                    </button>
                  ) : (
                    <button
                      onClick={() => withdraw(app.id)}
                      disabled={busyId === app.id}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      Withdraw application
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}