"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Textarea, Button } from "@/components/ui";

interface ChatComposerProps {
  onSend: (content: string) => void;
  onTyping?: () => void;
  onStopTyping?: () => void;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  leftSlot?: React.ReactNode; // e.g. a recipient selector, rendered above the input
}

/** Enter sends, Shift+Enter inserts a newline — matches Slack/Teams convention. */
export default function ChatComposer({
  onSend,
  onTyping,
  onStopTyping,
  placeholder = "Type a message…",
  disabled,
  sending,
  leftSlot,
}: ChatComposerProps) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value.trim());
    setValue("");
    onStopTyping?.();
  };

  return (
    <div className="space-y-2">
      {leftSlot}
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value.trim()) onTyping?.();
            else onStopTyping?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="max-h-32 flex-1 resize-none"
        />
        <Button size="icon" disabled={disabled || !value.trim()} loading={sending} onClick={handleSend} aria-label="Send message">
          <Send size={15} />
        </Button>
      </div>
    </div>
  );
}