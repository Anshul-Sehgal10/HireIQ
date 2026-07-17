"use client";

import { Modal } from "@/components/ui";

interface Props {
  title: string;
  categories: string[] | null;
  parsedData: Record<string, any> | null;
  hasEmbedding: boolean;
  onClose: () => void;
}

export default function ExtractionDetailModal({ title, categories, parsedData, hasEmbedding, onClose }: Props) {
  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Embedding status</p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            hasEmbedding ? "bg-success-bg text-success-foreground" : "bg-warning-bg text-warning-foreground"
          }`}>
            {hasEmbedding ? "Embedded — used in matching" : "No embedding — not used in matching"}
          </span>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned categories</p>
          {categories && categories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
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
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Structured extraction (raw)</p>
          {parsedData ? (
            <pre className="max-h-96 overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
              {JSON.stringify(parsedData, null, 2)}
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