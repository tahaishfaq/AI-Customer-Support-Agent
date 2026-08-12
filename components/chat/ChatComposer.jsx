"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ChatComposer({ disabled, onSend }) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-6">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={disabled}
          rows={1}
          className="min-h-11 max-h-32 flex-1 resize-none rounded-xl border-[var(--color-border)] bg-white"
        />
        <Button
          type="button"
          size="icon"
          disabled={disabled || !value.trim()}
          onClick={submit}
          aria-label="Send message"
          className="size-11 shrink-0 rounded-xl"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
