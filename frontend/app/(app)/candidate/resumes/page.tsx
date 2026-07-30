"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import ResumeUpload from "@/components/ResumeUpload";
import ResumeCard from "@/components/ResumeCard";
import ResumeDetailModal from "@/components/ResumeDetailModal";
import { PageHeader, Card, Button, SkeletonCard, useToast } from "@/components/ui";

interface ResumeVersion {
  id: string;
  version_number: number;
  s3_key: string;
  label: string | null;
  created_at: string;
  is_current: boolean;
  has_embedding: boolean;
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
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<ResumeVersion | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/resumes/");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to load resumes");
      data.sort((a: ResumeVersion, b: ResumeVersion) => a.version_number - b.version_number);
      setVersions(Array.isArray(data) ? data : []);
      console.log("Loaded resumes:", data);
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

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My resumes"
        description="Upload versions, pick your active resume, and see how each one was parsed"
        actions={
          <Button size="sm" onClick={() => setShowUpload((v) => !v)}>
            {showUpload ? "Cancel" : "Upload new"}
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
            {error}
          </div>
        )}

        {showUpload && (
          <Card className="p-5">
            <ResumeUpload onUploaded={() => { setShowUpload(false); load(); }} />
          </Card>
        )}

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && versions.length === 0 && !showUpload && (
          <Card className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Upload size={18} />
            </div>
            <p className="mb-3 text-sm text-muted-foreground">No resumes uploaded yet.</p>
            <Button size="sm" onClick={() => setShowUpload(true)}>Upload your first resume</Button>
          </Card>
        )}

        {!loading && versions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {versions.map((rv) => (
              <ResumeCard key={rv.id} version={rv} onClick={() => setSelected(rv)} />
            ))}
          </div>
        )}
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