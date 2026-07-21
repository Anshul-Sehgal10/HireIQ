"use client";

import { FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, Badge } from "@/components/ui";

interface ResumeCardVersion {
  id: string;
  version_number: number;
  label: string | null;
  created_at: string;
  is_current: boolean;
  has_embedding: boolean;
}

interface ResumeCardProps {
  version: ResumeCardVersion;
  onClick: () => void;
}

export default function ResumeCard({ version, onClick }: ResumeCardProps) {
  return (
    <Card interactive onClick={onClick} className="p-5">
      <CardContent className="flex items-start gap-3 p-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {version.label ?? `Version ${version.version_number}`}
            </h3>
            {version.is_current && <Badge variant="success" dot>Active</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Uploaded {new Date(version.created_at).toLocaleDateString()}
          </p>
          <div className="mt-2.5">
            {version.has_embedding ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                <CheckCircle2 size={12} /> Ready for matching
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
                <AlertTriangle size={12} /> Not embedded
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}