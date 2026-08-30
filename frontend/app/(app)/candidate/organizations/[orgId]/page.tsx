"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  ShieldCheck,
  Users,
  Briefcase,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, Badge, Skeleton, SkeletonText } from "@/components/ui";

interface PublicJob {
  id: string;
  title: string;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  hiring_count: number;
  salary_min: number | null;
  salary_max: number | null;
  scenario_enabled: boolean;
}

interface PublicMember {
  id: string;
  full_name: string;
  role: string;
}

interface OrgPublic {
  id: string;
  name: string;
  domain: string | null;
  description: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  logo_url: string | null;
  verification_status: string;
  member_count: number;
  open_jobs: PublicJob[];
  members: PublicMember[];
}

function formatSalary(min: number | null, max: number | null) {
  const fmt = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : `₹${n.toLocaleString()}`);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function OrganizationPublicPage() {
  return (
    <RoleGuard allowed={["candidate", "employer", "admin"]}>
      <Content />
    </RoleGuard>
  );
}

function Content() {
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<OrgPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/orgs/${orgId}/public`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? "Failed to load organisation");
        setOrg(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        href="/candidate/jobs"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to job feed
      </Link>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <Skeleton className="h-7 w-1/2" />
          <SkeletonText lines={4} />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
          {error}
        </div>
      )}

      {org && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-xl font-bold text-primary ring-1 ring-primary/20">
                {org.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo_url} alt={org.name} className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  initialsFor(org.name)
                )}
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{org.name}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {org.industry && <span>{org.industry}</span>}
                  {org.company_size && (
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {org.company_size} employees
                    </span>
                  )}
                  {org.domain && <span>{org.domain}</span>}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge variant={org.verification_status === "verified" ? "success" : "warning"}>
                    {org.verification_status === "verified" && <ShieldCheck size={11} />}
                    {org.verification_status}
                  </Badge>
                  {org.website && (
                    <a
                      href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
                    >
                      <Globe size={12} /> Visit website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* About */}
          {org.description && (
            <Card className="p-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">About</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{org.description}</p>
            </Card>
          )}

          {/* Open jobs */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Briefcase size={13} /> Open positions ({org.open_jobs.length})
            </h2>
            {org.open_jobs.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No open positions right now.</p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {org.open_jobs.map((job) => (
                  <Link key={job.id} href={`/candidate/jobs/${job.id}`}>
                    <Card interactive className="group p-4">
                      <CardContent className="flex items-center justify-between gap-3 p-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{job.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {job.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} /> {job.location}
                              </span>
                            )}
                            {job.work_mode && <span className="capitalize">{job.work_mode}</span>}
                            {job.job_level && <span className="capitalize">{job.job_level} level</span>}
                            {formatSalary(job.salary_min, job.salary_max) && (
                              <span className="font-medium text-foreground">
                                {formatSalary(job.salary_min, job.salary_max)}
                              </span>
                            )}
                            {job.scenario_enabled && (
                              <span className="flex items-center gap-1 text-primary">
                                <Sparkles size={11} /> Scenario
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowUpRight
                          size={15}
                          className="shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary"
                        />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Employees */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users size={13} /> Team ({org.member_count})
            </h2>
            {org.members.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No team members to show.</p>
              </Card>
            ) : (
              <Card className="p-2">
                <div className="divide-y divide-border">
                  {org.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {initialsFor(m.full_name)}
                      </span>
                      <p className="flex-1 truncate text-sm font-medium text-foreground">{m.full_name}</p>
                      <Badge variant="default" className="shrink-0 capitalize">
                        {m.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}