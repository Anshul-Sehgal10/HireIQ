"use client";

import type { OnlineUser } from "@/lib/useChatSocket";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function PresenceStrip({ users }: { users: OnlineUser[] }) {
  const visible = users.slice(0, 5);
  const overflow = users.length - visible.length;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-2">
        {visible.map((u) => (
          <span
            key={u.user_id}
            title={u.user_name}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/15 text-[10px] font-bold text-primary"
          >
            {initialsFor(u.user_name)}
          </span>
        ))}
        {overflow > 0 && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
            +{overflow}
          </span>
        )}
      </div>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        {users.length} online
      </span>
    </div>
  );
}