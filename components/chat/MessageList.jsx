"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { cn } from "@/lib/utils";

export function MessageList({
  messages,
  loading,
  compact = false,
  themed = false,
  showFeedback = false,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto",
        themed ? "bg-[var(--wc-chat-bg)]" : "bg-[#f8fafc]",
        compact ? "px-3 py-3" : "px-4 py-5 sm:px-8"
      )}
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          responseTime={msg.responseTime}
          themed={themed}
          showFeedback={showFeedback}
        />
      ))}
      {loading ? (
        <MessageBubble role="ASSISTANT" pending themed={themed} />
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}
