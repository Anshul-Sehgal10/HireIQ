"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("access_token");
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

export default function OrgSetupPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");

  // Create org state
  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");

  // Join org state
  const [orgId, setOrgId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!orgName.trim()) { setError("Organisation name is required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await apiFetch("/orgs/", {
        method: "POST",
        body: JSON.stringify({ name: orgName.trim(), domain: domain.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to create organisation");
      router.push("/dashboard/employer/org");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async () => {
    if (!orgId.trim()) { setError("Organisation ID is required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await apiFetch(`/orgs/${orgId.trim()}/requests/`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to send join request");
      router.push("/dashboard/employer/org/requested");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10">
          <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
            HireIQ
          </span>
          <h1 className="mt-3 text-3xl font-bold text-white leading-tight">
            Set up your workspace
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Every job posting belongs to an organisation. Create yours or join an existing one.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg mb-8 border border-slate-800">
          {(["create", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "create" ? "Create organisation" : "Join existing"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/25 text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {tab === "create" ? (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Organisation name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Company domain{" "}
                <span className="text-slate-600 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Used to auto-match colleagues by email domain later.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors mt-2"
            >
              {loading ? "Creating…" : "Create organisation"}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-4">
              <h3 className="text-sm font-semibold text-white mb-1">Already have an invite?</h3>
              <p className="text-xs text-slate-400">
                Check your email — your org admin may have sent you an invite link. Click it to
                join automatically without needing the org ID.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Organisation ID
              </label>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Paste the org UUID here"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Ask your organisation's admin for their org ID.
              </p>
            </div>
            <button
              onClick={handleRequestJoin}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
            >
              {loading ? "Sending request…" : "Send join request"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}