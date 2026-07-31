"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { useChatSocket } from "@/lib/useChatSocket";
import { PageHeader, Card, SkeletonText, useToast } from "@/components/ui";
import ChatBubble from "@/components/chat/ChatBubble";

interface Message {
  id: string;
  message_type: string;
  content: string;
  sent_at: string;
}

export default function CandidatePipelinePage() {
  return (
    <RoleGuard allowed={["candidate", "admin"]}>
      <Content />
    </RoleGuard>
  );
}

function Content() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read-only by design — no send handler, matches the REST route never
  // having a candidate POST endpoint either.
  const { connected } = useChatSocket<Message>(
    applicationId ? `/ws/applications/${applicationId}/pipeline/chat` : null,
    {
      onMessage: (data) => {
        setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      },
      onActivity: (message) => {
        // Ephemeral notice only — never appended to `messages`, matching
        // it not appearing in GET .../pipeline/messages history either.
        toast({ title: message, variant: "info" });
      },
    },
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/applications/${applicationId}/pipeline/messages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to load messages");
      setMessages(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Pipeline messages"
        actions={
          <Link href="/candidate/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
        }
      />

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">{error}</div>
        )}

        <Card className="flex flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Messages</h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success" : "bg-warning"}`} />
              {connected ? "Live" : "Reconnecting…"}
            </span>
          </div>

          <div className="flex h-96 flex-col gap-3 overflow-y-auto scrollbar-none p-4">
            {loading ? (
              <SkeletonText lines={3} />
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Inbox size={18} />
                </div>
                <p className="text-sm text-muted-foreground">No messages yet — check back once the employer moves your application forward.</p>
              </div>
            ) : (
              messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  content={m.content}
                  sentAt={m.sent_at}
                  align="left"
                  system={m.message_type === "system"}
                  senderLabel={m.message_type === "system" ? undefined : m.message_type === "direct" ? "Employer (direct)" : "Employer"}
                  initials={m.message_type === "system" ? undefined : "E"}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}