"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { AgentActivityBubble } from "@/components/chat/AgentActivityBubble";
import { ListCard } from "@/components/chat/ListCard";
import { cn } from "@/lib/utils";

const LIVE_PHASES = new Set([
  "selected",
  "validating",
  "running",
  "needs_confirmation",
  "needs_identity",
]);

/** True while prep/tools are still in flight (Thinking phase). */
function hasLiveActivity(activities) {
  return (Array.isArray(activities) ? activities : []).some((item) =>
    LIVE_PHASES.has(item?.phase)
  );
}

export function MessageList({
  messages,
  loading,
  humanTyping = false,
  humanTypingLabel = "Human agent is typing…",
  compact = false,
  themed = false,
  showKnowledgeDetails = false,
  showFeedback = false,
  intro = null,
  showIntro = true,
  onFeedback,
  onConfirmDecision = null,
  confirmBusy = false,
  activeActivities = [],
  instantInitialScroll = false,
  instantScrollKey = 0,
  onSourceClarifyReply = null,
  onOpenKnowledge = null,
  showResponseTime = true,
}) {
  const bottomRef = useRef(null);
  const lastScrollKey = useRef("");
  const mountedRef = useRef(false);
  const lastInstantScrollKey = useRef(instantScrollKey);

  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id || "";
    if (lastInstantScrollKey.current !== instantScrollKey) {
      lastScrollKey.current = "";
      lastInstantScrollKey.current = instantScrollKey;
    }
    const key = `${lastId}:${loading ? 1 : 0}:${humanTyping ? 1 : 0}`;
    if (key === lastScrollKey.current) return;
    lastScrollKey.current = key;
    bottomRef.current?.scrollIntoView({
      behavior: !mountedRef.current || instantInitialScroll ? "auto" : "smooth",
    });
    mountedRef.current = true;
  }, [instantInitialScroll, instantScrollKey, messages, loading, humanTyping]);

  // One assistant bubble per turn: it shows the server status line until tokens arrive, then
  // fills in place. Tool rows sit above it; they never replace it.
  const streamingMsg = messages.find((m) => m.streaming);
  const hideCompletedActivities = Boolean(
    streamingMsg && String(streamingMsg.content || "").length > 0
  );
  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto",
        themed ? "bg-[var(--wc-chat-bg)]" : "bg-[var(--color-bg)]",
        compact ? "px-3 py-3" : "px-4 py-5 sm:px-8"
      )}
    >
      {intro && showIntro ? (
        <div className="mb-1 flex justify-center px-2 py-2.5">
          <div
            className={cn(
              "w-full max-w-2xl rounded-xl border px-5 py-3 text-center shadow-[0_2px_12px_rgba(15,23,42,0.08)]",
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
      {messages.map((msg) => {
        return (
        <div key={msg.id} className="flex w-full flex-col items-start gap-2">
          {msg.streaming ? (
            <AgentActivityBubble
              activities={activeActivities}
              compact={compact}
              themed={themed}
              hideCompleted={hideCompletedActivities}
            />
          ) : null}
          <MessageBubble
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
          showKnowledgeDetails={showKnowledgeDetails}
          showCopy={showKnowledgeDetails}
          toolSteps={msg.toolSteps}
          searchUsed={Boolean(msg.searchUsed)}
          citations={msg.citations}
          sources={msg.sources}
          pendingConfirmations={msg.pendingConfirmations}
          onConfirmDecision={onConfirmDecision}
          confirmBusy={confirmBusy}
          streaming={Boolean(msg.streaming)}
          statusLabel={msg.statusLabel}
          showResponseTime={showResponseTime}
          showSourceClarifyButtons={
            Boolean(onSourceClarifyReply) && msg.id === lastMessageId
          }
          onSourceClarifyReply={onSourceClarifyReply}
          onOpenKnowledge={onOpenKnowledge}
          />
          {/* Large tool lists: live chunks while streaming, full list from the tool step after. */}
          {(msg.lists?.length
            ? msg.lists
            : (msg.toolSteps || []).map((step) => step?.list).filter(Boolean)
          ).map((list, index) => (
            <div key={list.listId || index} className={compact ? "w-full pl-0" : "w-full pl-10"}>
              <ListCard list={list} themed={themed} compact={compact} />
            </div>
          ))}
        </div>
        );
      })}
      {loading && !messages.some((m) => m.streaming) ? (
        <div className="flex w-full flex-col items-start gap-2">
          {hasLiveActivity(activeActivities) ? (
            <AgentActivityBubble
              activities={activeActivities}
              compact={compact}
              themed={themed}
              fallbackLabel={null}
            />
          ) : (
            <MessageBubble role="ASSISTANT" pending themed={themed} identity={intro} />
          )}
        </div>
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
