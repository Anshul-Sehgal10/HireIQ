"use client";

/**
 * ResumeUpload component
 *
 * Implements the two-step presigned upload flow:
 * 1. POST /resumes/upload-url  → get presigned PUT URL + resume_version_id
 * 2. PUT <upload_url>          → upload file directly to S3/R2
 * 3. POST /resumes/{id}/confirm → activate as current resume
 *
 * Props:
 *   onUploaded — called with the confirmed ResumeVersionResponse on success
 */

import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";

interface ResumeVersion {
  id: string;
  version_number: number;
  s3_key: string;
  created_at: string;
  is_current: boolean;
}

interface Props {
  onUploaded: (version: ResumeVersion) => void;
}

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

export default function ResumeUpload({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "confirming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!ACCEPTED_TYPES[f.type]) {
      setError("Only PDF and DOCX files are accepted.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB.");
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setStage("uploading");
    setProgress(0);

    try {
      // Step 1 — get presigned URL
      const urlRes = await apiFetch("/resumes/upload-url", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
        }),
      });
      if (!urlRes.ok) {
        const d = await urlRes.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to get upload URL");
      }
      const { upload_url, resume_version_id } = await urlRes.json();

      // Step 2 — PUT directly to S3/R2
      // Using XMLHttpRequest for upload progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", upload_url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      // Step 3 — confirm + activate
      setStage("confirming");
      const confirmRes = await apiFetch(`/resumes/${resume_version_id}/confirm`, {
        method: "POST",
      });
      if (!confirmRes.ok) {
        const d = await confirmRes.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to confirm upload");
      }
      const version: ResumeVersion = await confirmRes.json();
      setStage("done");
      onUploaded(version);
    } catch (e: any) {
      setError(e.message);
      setStage("idle");
    }
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${file ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-700 hover:border-slate-500 bg-slate-900/50"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="space-y-1">
            <p className="text-emerald-400 font-medium text-sm">{file.name}</p>
            <p className="text-slate-500 text-xs">
              {(file.size / 1024).toFixed(0)} KB · Click to change
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg className="w-10 h-10 text-slate-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-400 text-sm">
              Drop your resume here or <span className="text-blue-400 underline">browse</span>
            </p>
            <p className="text-slate-600 text-xs">PDF or DOCX · Max 5 MB</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {stage === "uploading" && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {stage === "confirming" && (
        <p className="mt-3 text-xs text-slate-400 animate-pulse">Activating resume…</p>
      )}

      {stage === "done" && (
        <p className="mt-3 text-xs text-emerald-400">Resume uploaded successfully.</p>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}

      {file && stage === "idle" && (
        <button
          onClick={handleUpload}
          className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
        >
          Upload resume
        </button>
      )}
    </div>
  );
}