"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
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
  onConfirmDecision = null,
  confirmBusy = false,
}) {
  const bottomRef = useRef(null);
  const lastScrollKey = useRef("");

  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id || "";
    const key = `${lastId}:${loading ? 1 : 0}:${humanTyping ? 1 : 0}`;
    if (key === lastScrollKey.current) return;
    lastScrollKey.current = key;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, humanTyping]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto",
        themed ? "bg-[var(--wc-chat-bg)]" : "bg-[var(--color-bg)]",
        compact ? "px-3 py-3" : "px-4 py-5 sm:px-8"
      )}
    >
      {intro ? (
        <div className="mb-2 flex justify-center px-2 py-3">
          <div
            className={cn(
              "w-full max-w-sm rounded-2xl border px-4 py-3.5 text-center shadow-sm",
              themed
                ? "border-[var(--wc-border)] bg-[var(--wc-shell)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)]"
            )}
          >
            <p
              className={cn(
                "text-sm font-semibold",
                themed
                  ? "text-[var(--wc-shell-fg)]"
                  : "text-[var(--color-text)]"
              )}
            >
              {intro.name}
            </p>
            {intro.description ? (
              <p
                className={cn(
                  "mt-1.5 line-clamp-3 text-[11px] leading-relaxed",
                  themed
                    ? "text-[var(--wc-muted)]"
                    : "text-[var(--color-text-secondary)]"
                )}
              >
                {intro.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          responseTime={msg.responseTime}
          themed={themed}
          showFeedback={showFeedback && !msg.local && Boolean(msg.id) && !String(msg.id).startsWith("welcome") && !msg.streaming}
          identity={intro}
          messageId={msg.id}
          initialFeedback={msg.feedback}
          initialFeedbackReason={msg.feedbackReason}
          compact={compact}
          onFeedback={onFeedback}
          usedKnowledge={msg.usedKnowledge}
          toolSteps={msg.toolSteps}
          pendingConfirmations={msg.pendingConfirmations}
          onConfirmDecision={onConfirmDecision}
          confirmBusy={confirmBusy}
          streaming={Boolean(msg.streaming)}
        />
      ))}
      {loading && !messages.some((m) => m.streaming) ? (
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
