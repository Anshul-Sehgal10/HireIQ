import Badge, { BadgeVariant } from "./Badge";

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "default" },
  published: { label: "Published", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  closed: { label: "Closed", variant: "danger" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** Single source of truth for job-status pills — replaces the duplicated
 *  StatusBadge previously defined separately in EmployerJobDetailModal.tsx
 *  and employer/jobs/page.tsx (which had drifted slightly in styling). */
export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status?.toLowerCase() || "draft";
  const config = STATUS_CONFIG[key] ?? { label: status, variant: "default" as BadgeVariant };
  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}