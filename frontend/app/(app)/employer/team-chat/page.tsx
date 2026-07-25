"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { PageHeader, Card, CardContent, Textarea, Button, SkeletonText, useToast } from "@/components/ui";

interface OrgMessage {
  id: string;
  sender_id: string | null;
  sender_name: string | null;
  content: string;
  sent_at: string;
}

export default function TeamChatPage() {
  return (
    <RoleGuard allowed={["employer", "admin"]}>
      <Content />
    </RoleGuard>
  );
}

function Content() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<OrgMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/orgs/mine/messages/");
      if (res.ok) setMessages(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await apiFetch("/orgs/mine/messages/", {
        method: "POST",
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "Failed to send message");
      }
      setContent("");
      await load();
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Team chat" description="Internal chat for your organisation — not visible to candidates" />

      <div className="space-y-4 p-6">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="mb-4 max-h-[60vh] min-h-[200px] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 scrollbar-none">
              {loading ? (
                <SkeletonText lines={4} />
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet — say hello to your team.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="rounded-lg bg-card px-3 py-2 text-sm">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{m.sender_name ?? "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(m.sent_at).toLocaleString()}</span>
                    </div>
                    <p className="text-foreground">{m.content}</p>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Message your team…"
                rows={2}
                className="flex-1"
              />
              <Button leftIcon={<Send size={13} />} loading={sending} onClick={send}>
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}