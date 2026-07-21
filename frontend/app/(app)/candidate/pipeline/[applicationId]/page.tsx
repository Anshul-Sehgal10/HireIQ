"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { PageHeader, Card, CardContent, SkeletonText } from "@/components/ui";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <Link
            href="/candidate/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
        }
      />

      <div className="space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
            {error}
          </div>
        )}

        {loading ? (
          <Card className="p-5">
            <SkeletonText lines={3} />
          </Card>
        ) : messages.length === 0 ? (
          <Card className="p-10 text-center">
            <CardContent className="p-0">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Inbox size={18} />
              </div>
              <p className="text-sm text-muted-foreground">
                No messages yet — check back once the employer moves your application forward.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {messages.map((m) => (
              <Card
                key={m.id}
                className={`p-4 ${m.message_type === "system" ? "bg-muted/40" : ""}`}
              >
                <CardContent className="p-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {m.message_type}
                  </span>
                  <p className={`mt-1 text-sm ${m.message_type === "system" ? "italic text-muted-foreground" : "text-foreground"}`}>
                    {m.content}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {new Date(m.sent_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}