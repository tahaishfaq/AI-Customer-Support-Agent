"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { AvatarImage } from "@/components/ui/avatar-image";
import { cn } from "@/lib/utils";

export function MessageList({
  messages,
  loading,
  humanTyping = false,
  humanTypingLabel = "Human agent is typing…",
  compact = false,
  themed = false,
  showFeedback = false,
  intro = null,
  onFeedback,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, humanTyping]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto",
        themed ? "bg-[var(--wc-chat-bg)]" : "bg-[#f8fafc]",
        compact ? "px-3 py-3" : "px-4 py-5 sm:px-8"
      )}
    >
      {intro ? (
        <div className="mb-1 flex flex-col items-center gap-2 px-2 py-4 text-center">
          {intro.avatarUrl ? (
            <AvatarImage
              src={intro.avatarUrl}
              size={56}
              className="size-14 rounded-full"
            />
          ) : (
            <span
              className="flex size-14 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: "var(--wc-primary)" }}
            >
              {(intro.name || "H")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join("")}
            </span>
          )}
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--wc-shell-fg)" }}
          >
            {intro.name}
          </p>
          {intro.description ? (
            <p
              className="line-clamp-3 max-w-[280px] text-[11px] leading-relaxed"
              style={{ color: "var(--wc-muted)" }}
            >
              {intro.description}
            </p>
          ) : null}
        </div>
      ) : null}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          responseTime={msg.responseTime}
          themed={themed}
          showFeedback={showFeedback && !msg.local && Boolean(msg.id) && !String(msg.id).startsWith("welcome")}
          identity={intro}
          messageId={msg.id}
          initialFeedback={msg.feedback}
          onFeedback={onFeedback}
          usedKnowledge={msg.usedKnowledge}
        />
      ))}
      {loading ? (
        <MessageBubble role="ASSISTANT" pending themed={themed} identity={intro} />
      ) : null}
      {humanTyping ? (
        <div className="flex items-end gap-2">
          <MessageBubble role="HUMAN" pending themed={themed} identity={intro} />
          <span
            className="pb-2 text-[11px]"
            style={{ color: themed ? "var(--wc-muted)" : "var(--color-muted)" }}
          >
            {humanTypingLabel}
          </span>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}
