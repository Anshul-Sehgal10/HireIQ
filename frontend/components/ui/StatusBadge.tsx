import Badge, { BadgeVariant } from "./Badge";

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  // Job statuses
  draft: { label: "Draft", variant: "default" },
  published: { label: "Published", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  closed: { label: "Closed", variant: "danger" },

  // Application statuses
  pending: { label: "Pending", variant: "default" },
  resume_rejected: { label: "Below match bar", variant: "danger" },
  resume_passed: { label: "Resume passed", variant: "primary" },
  scenario_pending: { label: "Scenario in progress", variant: "warning" },
  scenario_submitted: { label: "Scenario submitted", variant: "primary" },
  shortlisted: { label: "Shortlisted", variant: "success" },
  assessment: { label: "Assessment", variant: "primary" },
  interview: { label: "Interview", variant: "primary" },
  offer: { label: "Offer", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  withdrawn: { label: "Withdrawn", variant: "default" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** Single source of truth for status pills across job statuses AND
 *  application statuses — extended to cover the pipeline pages, which
 *  previously rendered raw uppercase text or ad hoc capitalize spans. */
export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status?.toLowerCase() || "draft";
  const config = STATUS_CONFIG[key] ?? {
    label: status?.replace(/_/g, " ") ?? status,
    variant: "default" as BadgeVariant,
  };
  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}