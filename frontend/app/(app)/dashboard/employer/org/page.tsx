"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RoleGuard } from "@/components/RoleGuard";

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

interface Org {
  id: string;
  name: string;
  domain: string | null;
  verification_status: string;
  owner_id: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  email: string | null;
  full_name: string | null;
}

interface Invite {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  token?: string;
}

const ROLE_BADGE: Record<string, string> = {
  owner:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  recruiter: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  viewer:    "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function OrgPage() {
  return (
    <RoleGuard allowed={["employer", "admin"]}>
      <OrgContent />
    </RoleGuard>
  );
}

function OrgContent() {
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [requests, setRequests] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"recruiter" | "viewer">("recruiter");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Decode current user id from token
  const currentUserId = (() => {
    try {
      const t = localStorage.getItem("access_token") ?? "";
      let b64 = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return JSON.parse(atob(b64)).sub as string;
    } catch { return null; }
  })();

  const isOwner = org ? org.owner_id === currentUserId : false;

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/orgs/mine");
      if (res.status === 404) {
        router.replace("/dashboard/employer/org/setup");
        return;
      }
      const data: Org = await res.json();
      setOrg(data);

      const [membersRes, invitesRes, requestsRes] = await Promise.all([
        apiFetch("/orgs/mine/members"),
        apiFetch("/orgs/invites/"),
        apiFetch("/orgs/mine/requests"),
      ]);

      if (membersRes.ok) setMembers(await membersRes.json());
      if (invitesRes.ok) setInvites(await invitesRes.json());
      if (requestsRes.ok) setRequests(await requestsRes.json());
      setLoading(false);
    })();
  }, [router]);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true); setInviteError(null);
    try {
      const res = await apiFetch("/orgs/invites/", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to send invite");
      setInvites((prev) => [data, ...prev]);
      setInviteEmail("");
    } catch (e: any) {
      setInviteError(e.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const cancelInvite = async (id: string) => {
    await apiFetch(`/orgs/invites/${id}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.id !== id));
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/onboarding/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const approveRequest = async (id: string) => {
    const res = await apiFetch(`/orgs/mine/requests/${id}/approve`, { method: "POST" });
    if (res.ok) {
      const member: Member = await res.json();
      setMembers((prev) => [...prev, member]);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const rejectRequest = async (id: string) => {
    await apiFetch(`/orgs/mine/requests/${id}/reject`, { method: "POST" });
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse text-sm">Loading workspace…</p>
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/employer" className="text-slate-500 hover:text-slate-300 text-sm">
            ← Dashboard
          </Link>
          <span className="text-slate-700">|</span>
          <div>
            <h1 className="text-white font-semibold">{org.name}</h1>
            {org.domain && (
              <p className="text-xs text-slate-500">{org.domain}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize
            ${org.verification_status === "verified"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
              : "bg-yellow-500/10 text-yellow-400 border-yellow-500/25"}`}>
            {org.verification_status}
          </span>
        </div>
        <Link
          href="/dashboard/employer/jobs"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Job postings →
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Members */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
            Members · {members.length}
          </h2>
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-300 shrink-0">
                    {(m.full_name ?? m.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{m.full_name ?? "—"}</p>
                    <p className="text-xs text-slate-400">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${ROLE_BADGE[m.role] ?? ROLE_BADGE.viewer}`}>
                    {m.role}
                  </span>
                  {isOwner && m.user_id !== currentUserId && (
                    <button
                      onClick={async () => {
                        await apiFetch(`/orgs/mine/members/${m.user_id}`, { method: "DELETE" });
                        setMembers((prev) => prev.filter((x) => x.id !== m.id));
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Invite form — owner/recruiter only */}
        {isOwner && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Invite a colleague
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              {inviteError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {inviteError}
                </p>
              )}
              <div className="flex gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="recruiter">Recruiter</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={sendInvite}
                  disabled={inviteLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  {inviteLoading ? "Sending…" : "Send invite"}
                </button>
              </div>

              {/* Pending invites */}
              {invites.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-500 font-medium">Pending invites</p>
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-2">
                      <div>
                        <span className="text-sm text-slate-200">{inv.invited_email}</span>
                        <span className="ml-2 text-xs text-slate-500 capitalize">{inv.role}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {inv.token && (
                          <button
                            onClick={() => copyInviteLink(inv.token!)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {copiedToken === inv.token ? "Copied!" : "Copy link"}
                          </button>
                        )}
                        <button
                          onClick={() => cancelInvite(inv.id)}
                          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Join requests — owner only */}
        {isOwner && requests.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Join requests · {requests.length}
            </h2>
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-5 py-4"
                >
                  <div>
                    <p className="text-sm text-white">{req.invited_email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Wants to join as {req.role}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveRequest(req.id)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectRequest(req.id)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Org ID for sharing */}
        <section className="border-t border-slate-800 pt-8">
          <p className="text-xs text-slate-600 mb-1 uppercase tracking-widest font-semibold">Organisation ID</p>
          <p className="text-xs font-mono text-slate-500 select-all break-all">{org.id}</p>
          <p className="text-xs text-slate-600 mt-1">Share this with colleagues who want to send a join request.</p>
        </section>
      </div>
    </div>
  );
}