"use client";

import { MapPin, Briefcase, Sparkles, ArrowUpRight } from "lucide-react";
import { Card, CardContent, Badge } from "@/components/ui";

interface JobCardJob {
  id: string;
  title: string;
  description: string;
  role_summary?: string | null;
  location: string | null;
  work_mode: string | null;
  job_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  org_name?: string | null;
  categories: string[] | null;
  scenario_enabled: boolean;
}

interface JobCardProps {
  job: JobCardJob;
  applied?: boolean;
  applicationStatus?: string;
  onClick: () => void;
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

export default function JobCard({ job, applied, applicationStatus, onClick }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const summary = job.role_summary?.trim() || truncate(job.description, 130);
  const meta = [job.work_mode, job.job_level].filter(Boolean);

  return (
    <Card interactive onClick={onClick} className="group p-4">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{job.title}</h3>
            {job.org_name && <p className="truncate text-xs text-muted-foreground">{job.org_name}</p>}
          </div>
          {applied ? (
            <Badge variant="success" className="shrink-0 whitespace-nowrap capitalize">
              {(applicationStatus ?? "applied").replace(/_/g, " ")}
            </Badge>
          ) : (
            <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
          )}
        </div>

        {salary && <p className="mt-2 text-xs font-semibold text-foreground">{salary}</p>}

        {summary && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{summary}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1.5">
              <MapPin size={12} className="shrink-0" /> {job.location}
            </span>
          )}
          {meta.length > 0 && (
            <span className="flex items-center gap-1.5 capitalize">
              <Briefcase size={12} className="shrink-0" /> {meta.join(" · ")}
            </span>
          )}
          {job.scenario_enabled && (
            <span className="flex items-center gap-1.5 text-primary">
              <Sparkles size={12} className="shrink-0" /> Scenario
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}