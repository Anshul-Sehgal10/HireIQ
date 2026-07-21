"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Users, MessagesSquare, Layers } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Select,
  Textarea,
  StatusBadge,
  MatchScoreRing,
  SkeletonText,
  useToast,
} from "@/components/ui";

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
  const { toast } = useToast();

  const [jobTitle, setJobTitle] = useState("");
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [stage, setStage] = useState("shortlisted");
  const [advancing, setAdvancing] = useState(false);

  const [msgType, setMsgType] = useState<"broadcast" | "direct">("broadcast");
  const [recipientId, setRecipientId] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const loadAll = async () => {
    setLoading(true);
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
      toast({ title: "Failed to load pipeline", description: e.message, variant: "error" });
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
      toast({ title: "Candidate shortlisted", variant: "success" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to shortlist", description: e.message, variant: "error" });
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
      toast({ title: "Candidate rejected", variant: "success" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to reject", description: e.message, variant: "error" });
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
      toast({ title: `Pipeline advanced to ${stage.replace(/_/g, " ")}`, variant: "success" });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Failed to advance stage", description: e.message, variant: "error" });
    } finally {
      setAdvancing(false);
    }
  };

  const sendMessage = async () => {
    if (!content.trim()) return;
    if (msgType === "direct" && !recipientId) {
      toast({ title: "Select a recipient for a direct message", variant: "error" });
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
      toast({ title: "Failed to send message", description: e.message, variant: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={loading ? "Pipeline" : `Pipeline: ${jobTitle}`}
        actions={
          <Link
            href="/employer/jobs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to job postings
          </Link>
        }
      />

      <div className="space-y-6 p-6">
        {/* Ranked candidates */}
        <Card className="p-5">
          <CardContent className="p-0">
            <div className="mb-4 flex items-center gap-2">
              <Users size={15} className="text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ranked candidates
              </h2>
            </div>

            {loading ? (
              <SkeletonText lines={4} />
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Candidate</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Match</th>
                      <th className="py-2 pr-4 font-medium">Scenario</th>
                      <th className="py-2 pr-4 font-medium">Pipeline</th>
                      <th className="py-2 pr-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.application_id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-foreground">{c.candidate_name}</p>
                          <p className="text-xs text-muted-foreground">{c.candidate_email}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="py-3 pr-4">
                          {c.match_score != null ? (
                            <MatchScoreRing score={c.match_score} size="sm" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {c.scenario_score != null ? (
                            <MatchScoreRing score={c.scenario_score} size="sm" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">
                          {c.in_pipeline ? "Yes" : "No"}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              loading={busyId === c.application_id}
                              disabled={c.in_pipeline}
                              onClick={() => shortlist(c.application_id)}
                            >
                              Shortlist
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              loading={busyId === c.application_id}
                              disabled={c.status === "rejected"}
                              onClick={() => reject(c.application_id)}
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stage control */}
        <Card className="p-5">
          <CardContent className="p-0">
            <div className="mb-4 flex items-center gap-2">
              <Layers size={15} className="text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Pipeline stage
              </h2>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Select value={stage} onChange={(e) => setStage(e.target.value)} className="sm:w-56">
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <Button loading={advancing} onClick={advanceStage}>
                Advance all active members to this stage
              </Button>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">
              Moves every active pipeline member's application status and posts a system message.
              Rejected/withdrawn candidates are skipped.
            </p>
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="p-5">
          <CardContent className="p-0">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Active members ({members.length})
            </h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one has been shortlisted yet.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {m.candidate_name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="text-foreground">{m.candidate_name}</span>
                    <span className="text-muted-foreground">({m.candidate_email})</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="p-5">
          <CardContent className="p-0">
            <div className="mb-4 flex items-center gap-2">
              <MessagesSquare size={15} className="text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Channel messages
              </h2>
            </div>

            <div className="mb-4 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 scrollbar-none">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.message_type === "system"
                      ? "bg-muted text-muted-foreground italic"
                      : "bg-card text-foreground"
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {m.message_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(m.sent_at).toLocaleString()}
                    </span>
                  </div>
                  {m.content}
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={msgType}
                  onChange={(e) => setMsgType(e.target.value as "broadcast" | "direct")}
                  className="sm:w-56"
                >
                  <option value="broadcast">Broadcast (all members)</option>
                  <option value="direct">Direct</option>
                </Select>
                {msgType === "direct" && (
                  <Select
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="flex-1"
                  >
                    <option value="">Select recipient…</option>
                    {members.map((m) => (
                      <option key={m.application_id} value={m.application_id}>
                        {m.candidate_name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Message content…"
                rows={2}
              />
              <Button leftIcon={<Send size={13} />} loading={sending} onClick={sendMessage}>
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}