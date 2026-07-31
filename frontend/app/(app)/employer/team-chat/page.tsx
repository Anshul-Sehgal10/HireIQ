"use client";

import { useEffect, useRef, useState } from "react";
import { Users2 } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import { useChatSocket, useTypingBroadcast, useTypingUsers, type OnlineUser } from "@/lib/useChatSocket";
import { PageHeader, Card, SkeletonText } from "@/components/ui";
import ChatBubble from "@/components/chat/ChatBubble";
import TypingIndicator from "@/components/chat/TypingIndicator";
import PresenceStrip from "@/components/chat/PresenceStrip";
import ChatComposer from "@/components/chat/ChatComposer";

interface OrgMessage {
  id: string;
  sender_id: string | null;
  sender_name: string | null;
  content: string;
  sent_at: string;
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function TeamChatPage() {
  return (
    <RoleGuard allowed={["employer", "admin"]}>
      <Content />
    </RoleGuard>
  );
}

function Content() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<OrgMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { typingUsers, handleTyping } = useTypingUsers(user?.id);

  const { connected, send } = useChatSocket<OrgMessage>("/ws/orgs/mine/chat", {
    onMessage: (data) => {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    },
    onPresence: setOnlineUsers,
    onTyping: handleTyping,
  });

  const { notifyTyping, stopTyping } = useTypingBroadcast(send);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/orgs/mine/messages/");
      if (res.ok) setMessages(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (connected) {
      send({ type: "message", content });
      return;
    }
    // Socket down — fall back to REST, which still pushes live to any
    // other connected sockets per the backend note.
    setSending(true);
    try {
      const res = await apiFetch("/orgs/mine/messages/", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      if (res.ok) await load();
    } finally {
      setSending(false);
    }
  };

  const typingNames = Object.values(typingUsers);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Team chat"
        description="Internal chat for your organisation — not visible to candidates"
        actions={<PresenceStrip users={onlineUsers} />}
      />

      <div className="p-6">
        <Card className="flex h-[70vh] flex-col overflow-hidden p-0">
          <div className="flex-1 space-y-3 overflow-y-auto scrollbar-none p-4">
            {loading ? (
              <SkeletonText lines={4} />
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Users2 size={19} />
                </div>
                <p className="text-sm text-muted-foreground">No messages yet — say hello to your team.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isOwn = m.sender_id === user?.id;
                return (
                  <ChatBubble
                    key={m.id}
                    content={m.content}
                    sentAt={m.sent_at}
                    senderLabel={isOwn ? undefined : m.sender_name ?? "Unknown"}
                    initials={initialsFor(m.sender_name ?? "?")}
                    align={isOwn ? "right" : "left"}
                  />
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-3">
            <TypingIndicator names={typingNames} />
            <div className="mt-1">
              <ChatComposer onSend={sendMessage} onTyping={notifyTyping} onStopTyping={stopTyping} sending={sending} placeholder="Message your team…" />
            </div>
          </div>
        </Card>

        {!connected && <p className="mt-2 text-center text-xs text-muted-foreground">Reconnecting…</p>}
      </div>
    </div>
  );
}