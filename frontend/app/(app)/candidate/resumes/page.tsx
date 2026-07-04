"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import ResumeUpload from "@/components/ResumeUpload";

interface ResumeVersion {
  id: string;
  version_number: number;
  s3_key: string;
  label: string | null;
  created_at: string;
  is_current: boolean;
}

export default function ResumesPage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <ResumesContent />
    </RoleGuard>
  );
}

function ResumesContent() {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/resumes/");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to load resumes");
      setVersions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (rv: ResumeVersion) => {
    setEditingId(rv.id);
    setEditLabel(rv.label ?? `Version ${rv.version_number}`);
  };

  const saveLabel = async (id: string) => {
    if (!editLabel.trim()) return;
    setBusyId(id);
    try {
      const res = await apiFetch(`/resumes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ label: editLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to rename");
      setVersions((prev) => prev.map((v) => (v.id === id ? data : v)));
      setEditingId(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const setCurrent = async (id: string) => {
    setBusyId(id);
    try {
      const res = await apiFetch(`/resumes/${id}/set-current`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to activate resume");
      setVersions((prev) => prev.map((v) => ({ ...v, is_current: v.id === id })));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this resume version? This can't be undone.")) return;
    setBusyId(id);
    try {
      const res = await apiFetch(`/resumes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Failed to delete");
      }
      setVersions((prev) => prev.filter((v) => v.id !== id));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-400 text-sm animate-pulse">Loading resumes…</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Resumes</h1>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {showUpload ? "Cancel" : "Upload new"}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showUpload && (
        <div className="mb-6 border border-gray-200 rounded-xl p-5 bg-white">
          <ResumeUpload onUploaded={() => { setShowUpload(false); load(); }} />
        </div>
      )}

      {versions.length === 0 && !showUpload && (
        <p className="text-gray-400 text-sm text-center py-12">No resumes uploaded yet.</p>
      )}

      <div className="space-y-3">
        {versions.map((rv) => (
          <div key={rv.id} className="border border-gray-200 rounded-xl p-4 bg-white flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editingId === rv.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm flex-1"
                    autoFocus
                  />
                  <button onClick={() => saveLabel(rv.id)} disabled={busyId === rv.id} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-2">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {rv.label ?? `Version ${rv.version_number}`}
                  </p>
                  {rv.is_current && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium shrink-0">Active</span>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {new Date(rv.created_at).toLocaleDateString()} · {rv.s3_key.split("/").pop()}
              </p>
            </div>

            {editingId !== rv.id && (
              <div className="flex items-center gap-2 shrink-0">
                {!rv.is_current && (
                  <button onClick={() => setCurrent(rv.id)} disabled={busyId === rv.id} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Set active
                  </button>
                )}
                <button onClick={() => startEdit(rv)} className="text-xs text-gray-500 hover:text-gray-700">Rename</button>
                <button
                  onClick={() => remove(rv.id)}
                  disabled={busyId === rv.id || rv.is_current}
                  className="text-xs text-red-500 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={rv.is_current ? "Set another resume as active first" : undefined}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}