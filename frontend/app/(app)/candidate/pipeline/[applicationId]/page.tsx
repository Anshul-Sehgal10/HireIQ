"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";

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
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div>
        <Link href="/candidate/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-foreground mt-2">Pipeline messages</h1>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No messages yet — check back once the employer moves your application forward.
        </p>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="border border-border rounded-lg p-3">
              <span className="text-xs uppercase text-muted-foreground">{m.message_type}</span>
              <p className="text-sm text-foreground mt-1">{m.content}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(m.sent_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}