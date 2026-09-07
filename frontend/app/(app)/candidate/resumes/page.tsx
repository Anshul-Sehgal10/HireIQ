"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import ResumeUpload from "@/components/ResumeUpload";
import ResumeCard from "@/components/ResumeCard";
import ResumeDetailModal from "@/components/ResumeDetailModal";
import { PageHeader, Card, SkeletonCard, useToast } from "@/components/ui";

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

export default function ResumesPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <ResumesContent />
    </RoleGuard>
  );
}

function ResumesContent() {
  const { toast } = useToast();
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResumeVersion | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/resumes/");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to load resumes");
      data.sort((a: ResumeVersion, b: ResumeVersion) => a.version_number - b.version_number);
      setVersions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdated = (id: string, patch: Partial<ResumeVersion>) => {
    setVersions((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, ...patch } : v));
      // If this version became active, deactivate the rest locally.
      if (patch.is_current) return next.map((v) => (v.id === id ? v : { ...v, is_current: false }));
      return next;
    });
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  const handleDeleted = (id: string) => {
    setVersions((prev) => prev.filter((v) => v.id !== id));
    setSelected(null);
    toast({ title: "Resume deleted", variant: "success" });
  };

  const quickSetActive = async (id: string) => {
    try {
      const res = await apiFetch(`/resumes/${id}/set-current`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to activate resume");
      handleUpdated(id, { is_current: true });
      toast({ title: "Set as active resume", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to activate", description: e.message, variant: "error" });
    }
  };

  const quickDownload = async (id: string) => {
    try {
      const res = await apiFetch(`/resumes/${id}/download-url`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to get download link");
      window.open(data.download_url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Failed to download", description: e.message, variant: "error" });
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="My resumes"
        description="Upload versions, pick your active resume, and see how each one was parsed"
      />

      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="flex h-full flex-col justify-center border-2 border-dashed border-border bg-muted/20 p-5">
            <ResumeUpload onUploaded={() => load()} />
          </Card>

          {loading &&
            Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}

          {!loading &&
            versions.map((rv) => (
              <ResumeCard
                key={rv.id}
                version={rv}
                onClick={() => setSelected(rv)}
                onSetActive={() => quickSetActive(rv.id)}
                onDownload={() => quickDownload(rv.id)}
              />
            ))}
        </div>
      </div>

      {selected && (
        <ResumeDetailModal
          version={selected}
          onClose={() => setSelected(null)}
          onUpdated={(patch) => handleUpdated(selected.id, patch)}
          onDeleted={() => handleDeleted(selected.id)}
        />
      )}
    </div>
  );
}