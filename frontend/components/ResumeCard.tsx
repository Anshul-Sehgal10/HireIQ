"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Check, FileText, MoreVertical, Star, Download, Eye } from "lucide-react";
import { Card, CardContent, Badge } from "@/components/ui";

interface ResumeCardVersion {
  id: string;
  version_number: number;
  label: string | null;
  created_at: string;
  is_current: boolean;
  has_embedding: boolean;
  file_size_bytes?: number | null;
  content_type?: string | null;
}

interface ResumeCardProps {
  version: ResumeCardVersion;
  onClick: () => void;
  onSetActive: () => void;
  onDownload: () => void;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatType(contentType?: string | null) {
  if (!contentType) return null;
  if (contentType.includes("pdf")) return "PDF";
  if (contentType.includes("word") || contentType.includes("document")) return "DOCX";
  return null;
}

export default function ResumeCard({ version, onClick, onSetActive, onDownload }: ResumeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const typeLabel = formatType(version.content_type);
  const sizeLabel = formatFileSize(version.file_size_bytes);
  const metaLine = [typeLabel, sizeLabel].filter(Boolean).join(" • ");

  return (
    <Card
      interactive
      onClick={onClick}
      className={`relative flex h-full flex-col p-5 ${
        version.is_current
          ? "border-2 border-primary/70 bg-primary/5"
          : "hover:border-primary/30"
      }`}
    >
      {version.is_current && (
        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-card">
          <Check size={13} />
        </span>
      )}

      <CardContent className="flex h-full flex-col p-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {version.label ?? `Version ${version.version_number}`}
              </h3>
              {metaLine && <p className="mt-0.5 text-xs text-muted-foreground">{metaLine}</p>}
            </div>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label="Resume actions"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreVertical size={15} />
            </button>

            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="glass-popup animate-sidebar-menu absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl p-1"
              >
                {!version.is_current && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onSetActive();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                  >
                    <Star size={14} /> Set active
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDownload();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                >
                  <Download size={14} /> Download
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onClick();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                >
                  <Eye size={14} /> View details
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex-1 space-y-2">
          {version.is_current && (
            <Badge variant="primary" dot>
              Active resume
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            Uploaded {new Date(version.created_at).toLocaleDateString()}
          </p>
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
      </CardContent>
    </Card>
  );
}