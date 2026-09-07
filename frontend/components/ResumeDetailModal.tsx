"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Star,
  RefreshCw,
  Trash2,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Modal, Button, Input, Badge, SkeletonText, useToast } from "@/components/ui";

interface ResumeVersion {
  id: string;
  version_number: number;
  s3_key: string;
  label: string | null;
  created_at: string;
  is_current: boolean;
  has_embedding: boolean;
  file_size_bytes?: number | null;
  content_type?: string | null;
}

interface ResumeDetail {
  id: string;
  version_number: number;
  label: string | null;
  categories: string[] | null;
  parsed_data: Record<string, any> | null;
  has_embedding: boolean;
}

interface Props {
  version: ResumeVersion;
  onClose: () => void;
  onUpdated: (updated: Partial<ResumeVersion>) => void;
  onDeleted: () => void;
}

const SKILL_GROUPS: { key: string; label: string }[] = [
  { key: "languages", label: "Languages" },
  { key: "frameworks_tools", label: "Frameworks & Tools" },
  { key: "cloud_platforms", label: "Cloud Platforms" },
  { key: "databases", label: "Databases" },
];

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

function isPdf(version: ResumeVersion) {
  if (version.content_type) return version.content_type.includes("pdf");
  return version.s3_key.toLowerCase().endsWith(".pdf");
}

export default function ResumeDetailModal({ version, onClose, onUpdated, onDeleted }: Props) {
  const { toast } = useToast();

  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [tab, setTab] = useState<"overview" | "document">("overview");
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(version.label ?? `Version ${version.version_number}`);

  const [busy, setBusy] = useState<"rename" | "activate" | "reprocess" | "delete" | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingDetail(true);
      try {
        const res = await apiFetch(`/resumes/${version.id}/details`);
        const data = await res.json();
        if (res.ok) setDetail(data);
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [version.id]);

  const loadDocument = async () => {
    if (docUrl || docLoading) return;
    setDocLoading(true);
    setDocError(null);
    try {
      const res = await apiFetch(`/resumes/${version.id}/download-url`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to load document");
      setDocUrl(data.download_url);
    } catch (e: any) {
      setDocError(e.message);
    } finally {
      setDocLoading(false);
    }
  };

  const switchTab = (next: "overview" | "document") => {
    setTab(next);
    if (next === "document") loadDocument();
  };

  const saveLabel = async () => {
    if (!labelDraft.trim()) return;
    setBusy("rename");
    try {
      const res = await apiFetch(`/resumes/${version.id}`, { method: "PATCH", body: JSON.stringify({ label: labelDraft.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to rename");
      onUpdated({ label: data.label });
      setEditing(false);
      toast({ title: "Renamed", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to rename", description: e.message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const setActive = async () => {
    setBusy("activate");
    try {
      const res = await apiFetch(`/resumes/${version.id}/set-current`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to activate resume");
      onUpdated({ is_current: true });
      toast({ title: "Set as active resume", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to activate", description: e.message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const reprocess = async () => {
    setBusy("reprocess");
    try {
      const res = await apiFetch(`/resumes/${version.id}/reprocess`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to reprocess resume");
      onUpdated({ has_embedding: data.has_embedding });
      const detailRes = await apiFetch(`/resumes/${version.id}/details`);
      if (detailRes.ok) setDetail(await detailRes.json());
      toast({ title: "Re-processed successfully", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to reprocess", description: e.message, variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this resume version? This can't be undone.")) return;
    setBusy("delete");
    try {
      const res = await apiFetch(`/resumes/${version.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Failed to delete");
      }
      onDeleted();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e.message, variant: "error" });
      setBusy(null);
    }
  };

  const skills = detail?.parsed_data?.skills as Record<string, string[]> | undefined;
  const hasAnySkills = skills && SKILL_GROUPS.some((g) => (skills[g.key]?.length ?? 0) > 0);

  const stats = detail?.parsed_data
    ? [
        { label: "work experience", count: detail.parsed_data.work_experience?.length ?? 0 },
        { label: "project", count: detail.parsed_data.projects?.length ?? 0 },
        { label: "education entry", count: detail.parsed_data.education?.length ?? 0 },
        { label: "certification", count: detail.parsed_data.certifications?.length ?? 0 },
      ].filter((s) => s.count > 0)
    : [];

  const typeLabel = formatType(version.content_type);
  const sizeLabel = formatFileSize(version.file_size_bytes);

  return (
    <Modal open onClose={onClose} size="xl" title={editing ? undefined : (version.label ?? `Version ${version.version_number}`)}>
      <div className="space-y-5">
        {/* Status row + rename */}
        {editing ? (
          <div className="flex items-center gap-2">
            <Input value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} autoFocus className="flex-1" />
            <Button size="sm" loading={busy === "rename"} onClick={saveLabel}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {version.is_current && <Badge variant="success" dot>Active resume</Badge>}
            {version.has_embedding ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 size={13} /> Embedded — used in matching
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                <AlertTriangle size={13} /> Not embedded — not used in matching
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              · Uploaded {new Date(version.created_at).toLocaleDateString()}
              {(typeLabel || sizeLabel) && ` · ${[typeLabel, sizeLabel].filter(Boolean).join(" • ")}`}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
          <button
            onClick={() => switchTab("overview")}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "overview" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => switchTab("document")}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === "document" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Original document
          </button>
        </div>

        {tab === "overview" ? (
          <div className="space-y-5">
            {stats.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {stats.map((s, i) => (
                  <span key={s.label}>
                    {i > 0 && " · "}
                    <span className="font-medium text-foreground">{s.count}</span> {s.label}
                    {s.count !== 1 ? "s" : ""}
                  </span>
                ))}
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned categories</p>
              {loadingDetail ? (
                <SkeletonText lines={1} />
              ) : detail?.categories && detail.categories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.categories.map((c) => (
                    <span key={c} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                      {c.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No categories assigned yet.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills</p>
              {loadingDetail ? (
                <SkeletonText lines={3} />
              ) : hasAnySkills ? (
                <div className="space-y-3">
                  {SKILL_GROUPS.map((g) => {
                    const items = skills?.[g.key] ?? [];
                    if (items.length === 0) return null;
                    return (
                      <div key={g.key}>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{g.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No skills extracted yet — this may still be processing, or the last attempt failed.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            {docLoading && <SkeletonText lines={4} />}
            {docError && <p className="text-sm text-danger">{docError}</p>}
            {docUrl && isPdf(version) && (
              <iframe
                src={docUrl}
                title="Resume preview"
                className="h-[65vh] w-full rounded-lg border border-border bg-muted/20"
              />
            )}
            {docUrl && !isPdf(version) && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 py-14 text-center">
                <FileText size={28} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Preview isn't available for Word documents.
                </p>
                <a href={docUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" leftIcon={<ExternalLink size={13} />}>
                    Open document
                  </Button>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {!editing && (
              <Button size="sm" variant="outline" leftIcon={<Pencil size={13} />} onClick={() => setEditing(true)}>
                Rename
              </Button>
            )}
            <Button size="sm" variant="outline" leftIcon={<RefreshCw size={13} />} loading={busy === "reprocess"} onClick={reprocess}>
              Re-parse & re-embed
            </Button>
            {docUrl && (
              <a href={docUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" leftIcon={<Download size={13} />}>
                  Download
                </Button>
              </a>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!version.is_current && (
              <Button size="sm" leftIcon={<Star size={13} />} loading={busy === "activate"} onClick={setActive}>
                Set active
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:bg-danger-bg hover:text-danger"
              loading={busy === "delete"}
              disabled={version.is_current}
              title={version.is_current ? "Set another resume as active first" : "Delete"}
              onClick={remove}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}