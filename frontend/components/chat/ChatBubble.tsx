"use client";

import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  content: string;
  sentAt: string;
  senderLabel?: string;
  initials?: string;
  align?: "left" | "right";
  system?: boolean;
}

/** System notices render as a centered muted pill, not a bubble — visually
 *  distinct from real conversation, matching how the rest of the app treats
 *  system messages (italic/muted) but with a bit more polish. */
export default function ChatBubble({ content, sentAt, senderLabel, initials, align = "left", system = false }: ChatBubbleProps) {
  if (system) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground">{content}</span>
      </div>
    );
  }

  const isRight = align === "right";

  return (
    <div className={cn("flex items-end gap-2", isRight ? "flex-row-reverse" : "flex-row")}>
      {initials && (
        <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
          {initials}
        </span>
      )}
      <div className={cn("max-w-[75%] space-y-1", isRight && "flex flex-col items-end")}>
        {senderLabel && (
          <p className="px-1 text-[11px] font-medium text-muted-foreground">{senderLabel}</p>
        )}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            isRight
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border bg-card text-foreground",
          )}
        >
          {content}
        </div>
        <p className="px-1 text-[10px] text-muted-foreground">
          {new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}