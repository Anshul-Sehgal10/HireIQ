"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Building2,
  Sparkles,
  ShieldCheck,
  Users,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import {
  Card,
  Button,
  Badge,
  Select,
  Skeleton,
  SkeletonText,
} from "@/components/ui";

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
  scenario_score_threshold: number;
  applicant_count?: number | null;
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

interface ApplicationSummary {
  id: string;
  job_id: string;
  status: string;
  match_score: number | null;
  is_override: boolean;
  scenario_enabled: boolean;
  scenario_score: number | null;
  scenario_ai_summary: string | null;
  scenario_meets_threshold: boolean | null;
}

interface RelevanceResult {
  resume_version_id: string;
  match_score: number | null;
  match_threshold: number;
  meets_threshold: boolean;
}

function formatSalary(min: number | null, max: number | null) {
  if (!min && !max) return null;
  if (min && max) return `₹${min.toLocaleString()} – ₹${max.toLocaleString()}`;
  return min ? `From ₹${min.toLocaleString()}` : `Up to ₹${max!.toLocaleString()}`;
}

export default function CandidateJobDetailPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <Content />
    </RoleGuard>
  );
}

function Content() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [application, setApplication] = useState<ApplicationSummary | undefined>(undefined);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");

  const [relevance, setRelevance] = useState<RelevanceResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [overridesRemaining, setOverridesRemaining] = useState<number | null>(null);
  const [showScenarioConfirm, setShowScenarioConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [jobRes, appsRes, resumesRes] = await Promise.all([
        apiFetch(`/jobs/${jobId}`),
        apiFetch("/applications/mine"),
        apiFetch("/resumes/"),
      ]);
      const jobData = await jobRes.json();
      if (!jobRes.ok) throw new Error(jobData.detail ?? "Failed to load job");
      setDetail(jobData);

      if (appsRes.ok) {
        const apps = await appsRes.json();
        const match = Array.isArray(apps)
          ? apps.find((a: any) => a.job_id === jobId && a.status !== "withdrawn")
          : undefined;
        setApplication(match);
      }
      if (resumesRes.ok) {
        const versions = await resumesRes.json();
        const list = Array.isArray(versions) ? versions : [];
        setResumeVersions(list);
        const current = list.find((r: ResumeVersion) => r.is_current);
        setSelectedResumeId(current?.id ?? list[0]?.id ?? "");
      }
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const checkRelevance = async () => {
    if (!selectedResumeId) return;
    setChecking(true);
    setRelevance(null);
    setApplyError(null);
    try {
      const res = await apiFetch(`/jobs/${jobId}/relevance?resume_version_id=${selectedResumeId}`);
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
        body: JSON.stringify({ job_id: jobId, resume_version_id: selectedResumeId, override }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.detail?.code === "low_match") {
          setOverridesRemaining(data.detail.overrides_remaining ?? null);
          setApplyError(data.detail.message);
          return;
        }
        throw new Error(data.detail?.message ?? data.detail ?? "Failed to apply");
      }

      const newStatus = data.status ?? "pending";
      if (newStatus === "scenario_pending") {
        router.push(`/candidate/scenario/${data.id}`);
        return;
      }
      await load();
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!application) return;
    if (!confirm("Withdraw this application? This can't be undone.")) return;
    setWithdrawing(true);
    try {
      const res = await apiFetch(`/applications/${application.id}/withdraw`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to withdraw");
      }
      await load();
    } catch (e: any) {
      setApplyError(e.message);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link
        href="/candidate/jobs"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to job feed
      </Link>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <SkeletonText lines={6} />
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
          {loadError}
        </div>
      )}

      {detail && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ---------------------------------------------------------- */}
          {/* Main column                                                 */}
          {/* ---------------------------------------------------------- */}
          <div className="min-w-0 space-y-6">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {detail.scenario_enabled && (
                  <Badge variant="primary">
                    <Sparkles size={11} /> Scenario question
                  </Badge>
                )}
                {detail.applicant_count != null && detail.applicant_count > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users size={12} /> {detail.applicant_count} applicant{detail.applicant_count !== 1 ? "s" : ""} so far
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{detail.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{detail.org_name}</p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {detail.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} /> {detail.location}
                  </span>
                )}
                {detail.work_mode && (
                  <span className="flex items-center gap-1.5 capitalize">
                    <Briefcase size={13} /> {detail.work_mode}
                  </span>
                )}
                {detail.job_level && <span className="capitalize">{detail.job_level} level</span>}
              </div>

              {formatSalary(detail.salary_min, detail.salary_max) && (
                <p className="mt-2.5 text-sm font-medium text-foreground">
                  {formatSalary(detail.salary_min, detail.salary_max)}
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

            <Card className="p-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">About the role</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{detail.description}</p>
            </Card>

            {detail.scenario_enabled && (
              <Card className="border-primary/20 bg-primary/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Includes a scenario question</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  After you apply, you'll be asked a role-specific scenario question with a time limit. You'll need to
                  score at least {Math.round(detail.scenario_score_threshold * 100)}% to pass — if you don't, you can
                  use a monthly override to submit anyway. It's generated when you apply, so there's nothing to preview
                  beforehand.
                </p>
              </Card>
            )}
          </div>

          {/* ---------------------------------------------------------- */}
          {/* Sticky sidebar — action panel + org card, always in view    */}
          {/* ---------------------------------------------------------- */}
          <aside className="space-y-4 self-start lg:sticky lg:top-6">
            <Card className="p-5">
              {application ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-success-foreground">You've applied to this job.</p>
                    <Badge>{application.status.replace(/_/g, " ")}</Badge>
                  </div>

                  {application.match_score != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Resume match</span>
                      <span className="font-medium text-foreground">{Math.round(application.match_score * 100)}%</span>
                    </div>
                  )}

                  {detail.scenario_enabled && application.scenario_score != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Scenario score</span>
                      <span
                        className={`font-medium ${application.scenario_meets_threshold === false ? "text-warning" : "text-foreground"}`}
                      >
                        {Math.round(application.scenario_score * 100)}%
                        {application.scenario_meets_threshold === false && " (below bar)"}
                      </span>
                    </div>
                  )}

                  {application.is_override && (
                    <p className="text-xs text-warning">You used a monthly override on this application.</p>
                  )}

                  {applyError && <p className="text-sm text-danger">{applyError}</p>}

                  {application.status === "scenario_pending" && (
                    <Link
                      href={
                        application.scenario_score != null
                          ? "/candidate/dashboard"
                          : `/candidate/scenario/${application.id}`
                      }
                      className="block rounded-lg bg-primary py-2 text-center text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                    >
                      {application.scenario_score != null ? "Manage on dashboard" : "Continue to scenario test"}
                    </Link>
                  )}

                  {!["withdrawn", "rejected"].includes(application.status) && (
                    <Button variant="outline" className="w-full" loading={withdrawing} onClick={handleWithdraw}>
                      Withdraw application
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {resumeVersions.length === 0 ? (
                    <div className="space-y-3 text-center">
                      <p className="text-sm text-muted-foreground">Upload a resume before you can apply.</p>
                      <Link href="/candidate/resumes">
                        <Button className="w-full">Upload resume</Button>
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Resume to use
                        </label>
                        <Select
                          value={selectedResumeId}
                          onChange={(e) => {
                            setSelectedResumeId(e.target.value);
                            setRelevance(null);
                          }}
                        >
                          {resumeVersions.map((rv) => (
                            <option key={rv.id} value={rv.id}>
                              {rv.label ?? `Version ${rv.version_number}`}
                              {rv.is_current ? " (active)" : ""}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {!relevance && (
                        <Button className="w-full" loading={checking} disabled={!selectedResumeId} onClick={checkRelevance}>
                          Check relevance
                        </Button>
                      )}

                      {relevance && (
                        <div
                          className={`rounded-lg border p-4 ${relevance.meets_threshold ? "border-success-border bg-success-bg" : "border-warning-border bg-warning-bg"}`}
                        >
                          <p
                            className={`text-sm font-medium ${relevance.meets_threshold ? "text-success-foreground" : "text-warning-foreground"}`}
                          >
                            {relevance.match_score != null
                              ? `${Math.round(relevance.match_score * 100)}% match`
                              : "Match score not available yet"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {relevance.meets_threshold
                              ? "This looks like a strong match for your profile."
                              : "Your profile is not a strong match for this role based on your skills and experience."}
                          </p>
                        </div>
                      )}

                      {applyError && <p className="text-sm text-danger">{applyError}</p>}

                      {relevance && detail.scenario_enabled && showScenarioConfirm && (
                        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                          <p className="text-sm text-foreground">
                            This job requires a scenario-based test. Once you confirm, you'll be taken straight to it
                            and the timer starts immediately — make sure you're ready before continuing.
                          </p>
                          <div className="flex flex-col gap-2">
                            <Button loading={applying} onClick={() => submitApply(!relevance.meets_threshold)}>
                              Yes, start the test
                            </Button>
                            <Button variant="outline" disabled={applying} onClick={() => setShowScenarioConfirm(false)}>
                              Not yet
                            </Button>
                          </div>
                        </div>
                      )}

                      {relevance && (!detail.scenario_enabled || !showScenarioConfirm) && (
                        <Button
                          className="w-full"
                          variant={relevance.meets_threshold ? "primary" : "secondary"}
                          loading={applying}
                          onClick={() =>
                            detail.scenario_enabled ? setShowScenarioConfirm(true) : submitApply(!relevance.meets_threshold)
                          }
                        >
                          {relevance.meets_threshold
                            ? "Apply"
                            : `Apply anyway${overridesRemaining != null ? ` (${overridesRemaining} left)` : ""}`}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 size={15} />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{detail.org_name}</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Verification</span>
                  <Badge variant={detail.org_verification_status === "verified" ? "success" : "warning"}>
                    {detail.org_verification_status === "verified" && <ShieldCheck size={11} />}
                    {detail.org_verification_status}
                  </Badge>
                </div>
                {detail.org_domain && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Domain</span>
                    <span className="text-foreground">{detail.org_domain}</span>
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}