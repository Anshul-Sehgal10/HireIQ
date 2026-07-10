"use client";

interface Props {
  title: string;
  categories: string[] | null;
  parsedData: Record<string, any> | null;
  hasEmbedding: boolean;
  onClose: () => void;
}

export default function ExtractionDetailModal({ title, categories, parsedData, hasEmbedding, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Embedding status</p>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            hasEmbedding ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}>
            {hasEmbedding ? "Embedded — used in matching" : "No embedding — not used in matching"}
          </span>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assigned categories</p>
          {categories && categories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <span key={c} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full capitalize">
                  {c.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No categories assigned yet.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Structured extraction (raw)</p>
          {parsedData ? (
            <pre className="text-xs font-mono bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto max-h-96 leading-relaxed">
              {JSON.stringify(parsedData, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-gray-400">
              No extraction data yet — this may still be processing, or the last attempt failed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}