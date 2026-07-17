"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";

interface RankedCandidate {
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  match_score: number | null;
  scenario_score: number | null;
  scenario_ai_summary: string | null;
  is_override: boolean;
  applied_at: string;
  in_pipeline: boolean;
}

interface Member {
  id: string;
  application_id: string;
  candidate_name: string;
  candidate_email: string;
  is_active: boolean;
  joined_at: string;
}

interface Message {
  id: string;
  sender_id: string | null;
  recipient_application_id: string | null;
  message_type: string;
  content: string;
  sent_at: string;
}

const STAGES = ["shortlisted", "assessment", "interview", "offer", "closed"];

export default function EmployerPipelinePage() {
  return (
    <RoleGuard allowed={["employer", "admin"]}>
      <Content />
    </RoleGuard>
  );
}

function Content() {
  const { jobId } = useParams<{ jobId: string }>();

  const [jobTitle, setJobTitle] = useState("");
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [stage, setStage] = useState("shortlisted");
  const [advancing, setAdvancing] = useState(false);

  const [msgType, setMsgType] = useState<"broadcast" | "direct">("broadcast");
  const [recipientId, setRecipientId] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobRes, rankedRes, membersRes, messagesRes] = await Promise.all([
        apiFetch(`/jobs/${jobId}`),
        apiFetch(`/jobs/${jobId}/candidates/ranked`),
        apiFetch(`/jobs/${jobId}/pipeline/members`),
        apiFetch(`/jobs/${jobId}/pipeline/messages`),
      ]);
      if (jobRes.ok) setJobTitle((await jobRes.json()).title);
      if (rankedRes.ok) setCandidates(await rankedRes.json());
      if (membersRes.ok) setMembers(await membersRes.json());
      if (messagesRes.ok) setMessages(await messagesRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const shortlist = async (applicationId: string) => {
    setBusyId(applicationId);
    try {
      const res = await apiFetch(`/jobs/${jobId}/pipeline/shortlist/${applicationId}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to shortlist");
      }
      await loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (applicationId: string) => {
    if (!confirm("Reject this candidate?")) return;
    setBusyId(applicationId);
    try {
      const res = await apiFetch(`/jobs/${jobId}/pipeline/reject/${applicationId}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to reject");
      }
      await loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const advanceStage = async () => {
    setAdvancing(true);
    try {
      const res = await apiFetch(`/jobs/${jobId}/pipeline/advance`, {
        method: "POST",
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to advance stage");
      }
      await loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAdvancing(false);
    }
  };

  const sendMessage = async () => {
    if (!content.trim()) return;
    if (msgType === "direct" && !recipientId) {
      alert("Select a recipient for a direct message");
      return;
    }
    setSending(true);
    try {
      const body: Record<string, unknown> = { message_type: msgType, content: content.trim() };
      if (msgType === "direct") body.recipient_application_id = recipientId;
      const res = await apiFetch(`/jobs/${jobId}/pipeline/messages`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to send message");
      }
      setContent("");
      const messagesRes = await apiFetch(`/jobs/${jobId}/pipeline/messages`);
      if (messagesRes.ok) setMessages(await messagesRes.json());
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="p-8 text-sm text-muted-foreground animate-pulse">Loading pipeline…</p>;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <Link href="/employer/jobs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to job postings
        </Link>
        <h1 className="text-2xl font-semibold text-foreground mt-2">Pipeline: {jobTitle}</h1>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Ranked candidates */}
      <section className="border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Ranked candidates
        </h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Candidate</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Match</th>
                  <th className="py-2 pr-4">Scenario</th>
                  <th className="py-2 pr-4">Pipeline</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.application_id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">
                      <p className="font-medium text-foreground">{c.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">{c.candidate_email}</p>
                    </td>
                    <td className="py-2 pr-4 capitalize">{c.status.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-4">{c.match_score != null ? `${Math.round(c.match_score * 100)}%` : "—"}</td>
                    <td className="py-2 pr-4">{c.scenario_score != null ? `${Math.round(c.scenario_score * 100)}%` : "—"}</td>
                    <td className="py-2 pr-4">{c.in_pipeline ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4 space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => shortlist(c.application_id)}
                        disabled={busyId === c.application_id || c.in_pipeline}
                        className="text-xs bg-success text-white px-2.5 py-1 rounded-lg disabled:opacity-40"
                      >
                        Shortlist
                      </button>
                      <button
                        onClick={() => reject(c.application_id)}
                        disabled={busyId === c.application_id || c.status === "rejected"}
                        className="text-xs bg-danger text-white px-2.5 py-1 rounded-lg disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stage control */}
      <section className="border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Pipeline stage
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="border border-input rounded-lg px-3 py-1.5 text-sm bg-card text-foreground"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={advanceStage}
            disabled={advancing}
            className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {advancing ? "Advancing…" : "Advance all active members to this stage"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Moves every active pipeline member's application status and posts a system message. Rejected/withdrawn candidates are skipped.
        </p>
      </section>

      {/* Members */}
      <section className="border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Active members ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has been shortlisted yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {members.map((m) => (
              <li key={m.id} className="text-foreground">
                {m.candidate_name} <span className="text-muted-foreground">({m.candidate_email})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Messages */}
      <section className="border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Channel messages
        </h2>
        <div className="space-y-2 max-h-72 overflow-y-auto mb-4 border border-border rounded-lg p-3 bg-muted/30">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="text-xs uppercase text-muted-foreground mr-2">[{m.message_type}]</span>
              {m.content}
              <span className="text-xs text-muted-foreground ml-2">
                {new Date(m.sent_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={msgType}
              onChange={(e) => setMsgType(e.target.value as "broadcast" | "direct")}
              className="border border-input rounded-lg px-2.5 py-1.5 text-sm bg-card text-foreground"
            >
              <option value="broadcast">Broadcast (all members)</option>
              <option value="direct">Direct</option>
            </select>
            {msgType === "direct" && (
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="border border-input rounded-lg px-2.5 py-1.5 text-sm bg-card text-foreground flex-1"
              >
                <option value="">Select recipient…</option>
                {members.map((m) => (
                  <option key={m.application_id} value={m.application_id}>
                    {m.candidate_name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Message content…"
            rows={2}
            className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-card text-foreground"
          />
          <button
            onClick={sendMessage}
            disabled={sending}
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </section>
    </div>
  );
}