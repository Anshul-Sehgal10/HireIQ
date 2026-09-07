"use client";

import Link from "next/link";
import { ArrowUpRight, Briefcase, Building2, ChevronRight, Clock, MapPin, Sparkles, Timer } from "lucide-react";
import { Card, CardContent, StatusBadge } from "@/components/ui";

interface JobCardJob {
  id: string;
  org_id?: string;
  title: string;
  description: string;
  role_summary?: string | null;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  job_type?: string | null;
  salary_min: number | null;
  salary_max: number | null;
  org_name?: string | null;
  logo_url?: string | null;
  categories: string[] | null;
  scenario_enabled: boolean;
  created_at?: string | null;
}

interface JobCardProps {
  job: JobCardJob;
  applied?: boolean;
  applicationStatus?: string;
  onClick: () => void;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

function formatSalary(min: number | null, max: number | null) {
  const fmt = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : `₹${n.toLocaleString()}`);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function formatPostedDate(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Posted today";
  if (diffDays === 1) return "Posted yesterday";
  if (diffDays < 30) return `Posted ${diffDays}d ago`;
  return `Posted ${Math.floor(diffDays / 30)}mo ago`;
}

function orgInitials(name?: string | null) {
  if (!name) return "?";
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

const PILL_TONE: Record<"default" | "primary" | "warning", string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning-bg text-warning-foreground",
};

function MetaPill({
  icon: Icon,
  tone = "default",
  children,
}: {
  icon: React.ElementType;
  tone?: "default" | "primary" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL_TONE[tone]}`}>
      <Icon size={11} className="shrink-0" />
      {children}
    </span>
  );
}

function OrgLogo({ job }: { job: JobCardJob }) {
  return job.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={job.logo_url} alt={job.org_name ?? ""} className="h-full w-full object-cover" />
  ) : (
    <>{orgInitials(job.org_name)}</>
  );
}

export default function JobCard({ job, applied, applicationStatus, onClick }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const summary = job.role_summary?.trim() || job.description;
  const posted = formatPostedDate(job.created_at);

  return (
    <Card interactive onClick={onClick} className="group flex h-full flex-col p-4">
      <CardContent className="flex h-full flex-col p-0">
        <div className="flex-1 space-y-3">
          {/* Logo + title/company. Only a small fixed-width arrow icon sits
              on the right here — application status moved out of this row
              entirely (see below) so a long status label never squeezes
              the title. Title gets 2 lines via line-clamp before truncating. */}
          <div className="flex items-start gap-3">
            {job.org_id ? (
              <Link
                href={`/candidate/organizations/${job.org_id}`}
                onClick={(e) => e.stopPropagation()}
                title={job.org_name ?? undefined}
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
              >
                <OrgLogo job={job} />
              </Link>
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-xs font-bold text-primary">
                <OrgLogo job={job} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground sm:text-[15px]">{job.title}</h3>
              {job.org_name && <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{job.org_name}</p>}
            </div>

            <ArrowUpRight
              size={15}
              className="mt-1 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary"
            />
          </div>

          {(applied || salary) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {applied && <StatusBadge status={applicationStatus ?? "pending"} />}
              {salary && (
                <span className="inline-flex items-center rounded-md bg-success-bg px-2 py-0.5 text-xs font-semibold text-success-foreground">
                  {salary}
                </span>
              )}
            </div>
          )}

          {summary && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{summary}</p>}

          <div className="flex flex-wrap gap-1.5">
            {job.location && <MetaPill icon={MapPin}>{job.location}</MetaPill>}
            {job.work_mode && (
              <MetaPill icon={Building2} tone="primary">
                <span className="capitalize">{job.work_mode}</span>
              </MetaPill>
            )}
            {job.job_type && (
              <MetaPill icon={Timer}>{JOB_TYPE_LABELS[job.job_type] ?? job.job_type.replace(/_/g, " ")}</MetaPill>
            )}
            {job.job_level && (
              <MetaPill icon={Briefcase} tone="warning">
                <span className="capitalize">{job.job_level}</span>
              </MetaPill>
            )}
            {job.scenario_enabled && <MetaPill icon={Sparkles} tone="primary">Scenario</MetaPill>}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {posted && (
              <>
                <Clock size={11} />
                {posted}
              </>
            )}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
            View details <ChevronRight size={12} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}