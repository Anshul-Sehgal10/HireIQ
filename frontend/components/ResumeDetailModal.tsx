"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Pencil, Star, RefreshCw, Trash2 } from "lucide-react";
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

export default function ResumeDetailModal({ version, onClose, onUpdated, onDeleted }: Props) {
  const { toast } = useToast();

  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

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

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? undefined : (version.label ?? `Version ${version.version_number}`)}>
      <div className="space-y-6">
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
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {!editing && (
              <Button size="sm" variant="outline" leftIcon={<Pencil size={13} />} onClick={() => setEditing(true)}>
                Rename
              </Button>
            )}
            {!version.is_current && (
              <Button size="sm" variant="outline" leftIcon={<Star size={13} />} loading={busy === "activate"} onClick={setActive}>
                Set active
              </Button>
            )}
            <Button size="sm" variant="outline" leftIcon={<RefreshCw size={13} />} loading={busy === "reprocess"} onClick={reprocess}>
              Re-parse & re-embed
            </Button>
          </div>
          <Button
            size="sm"
            variant="destructive"
            leftIcon={<Trash2 size={13} />}
            loading={busy === "delete"}
            disabled={version.is_current}
            title={version.is_current ? "Set another resume as active first" : undefined}
            onClick={remove}
          >
            Delete
          </Button>
        </div>

        <div className="border-t border-border pt-5">
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Structured extraction (raw)</p>
          {loadingDetail ? (
            <SkeletonText lines={5} />
          ) : detail?.parsed_data ? (
            <pre className="max-h-80 overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 scrollbar-none">
              {JSON.stringify(detail.parsed_data, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No extraction data yet — this may still be processing, or the last attempt failed.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}