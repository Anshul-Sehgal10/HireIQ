"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, Users, TrendingUp, Layers } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
import PageHeader from "@/components/ui/PageHeader";

interface Org {
  id: string;
  name: string;
  domain: string | null;
  verification_status: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  hiring_count: number;
  scenario_enabled: boolean;
}

interface EmployerApplication {
  id: string;
  job_id: string;
  status: string;
  match_score: number | null;
}

export default function EmployerDashboard() {
  return (
    <RoleGuard allowed={["employer", "admin"]}>
      <DashboardContent />
    </RoleGuard>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const orgRes = await apiFetch("/orgs/mine");
      if (orgRes.status === 404) {
        router.replace("/employer/organization/setup");
        return;
      }
      if (!orgRes.ok) {
        setLoading(false);
        return;
      }
      const orgData: Org = await orgRes.json();
      setOrg(orgData);

      const jobsRes = await apiFetch("/jobs/mine");
      const jobsData: Job[] = jobsRes.ok ? await jobsRes.json() : [];
      setJobs(jobsData);

      // Reuses the existing per-job applicants endpoint — there's no
      // aggregate "all applicants across my jobs" endpoint yet, so we fan
      // out over published jobs. Fine at portfolio scale; flagged in
      // TODO.md as a candidate for a dedicated backend aggregate endpoint
      // if the org's job count grows meaningfully.
      const publishedJobs = jobsData.filter((j) => j.status === "published");
      const appResults = await Promise.all(
        publishedJobs.map((j) =>
          apiFetch(`/applications/job/${j.id}`).then((r) => (r.ok ? r.json() : [])),
        ),
      );
      setApplications(appResults.flat());
      setLoading(false);
    })();
  }, [router]);

  const openJobs = jobs.filter((j) => j.status === "published");
  const totalPositions = openJobs.reduce((sum, j) => sum + j.hiring_count, 0);
  const scenarioJobs = openJobs.filter((j) => j.scenario_enabled).length;
  const scoredApps = applications.filter((a) => a.match_score != null);
  const avgMatch = scoredApps.length
    ? scoredApps.reduce((sum, a) => sum + (a.match_score ?? 0), 0) / scoredApps.length
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={`Welcome back${user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}`}
        description={org?.name}
        actions={
          <Link
            href="/employer/jobs"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary-hover px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Briefcase size={15} />
            Manage jobs
          </Link>
        }
      />

      <div className="p-6 space-y-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={Briefcase} label="Open postings" value={openJobs.length} />
            <StatCard icon={Layers} label="Open positions" value={totalPositions} />
            <StatCard icon={Users} label="In pipeline" value={applications.length} />
            <StatCard
              icon={TrendingUp}
              label="Avg. match score"
              value={avgMatch != null ? `${Math.round(avgMatch * 100)}%` : "—"}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/employer/jobs">
            <Card interactive className="p-6 h-full">
              <CardContent className="p-0">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Briefcase size={18} />
                </div>
                <h3 className="font-semibold text-foreground">Job postings</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {openJobs.length > 0
                    ? `${openJobs.length} open · ${scenarioJobs} with scenario tests`
                    : "Create and manage open roles"}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/employer/organization">
            <Card interactive className="p-6 h-full">
              <CardContent className="p-0">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 size={18} />
                </div>
                <h3 className="font-semibold text-foreground">Organisation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {org?.verification_status === "verified"
                    ? "Verified · manage members and invites"
                    : "Verification pending · manage members and invites"}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-5">
      <CardContent className="p-0">
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={15} />
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}