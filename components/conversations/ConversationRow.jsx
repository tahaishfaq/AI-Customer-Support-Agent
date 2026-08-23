"use client";

import Link from "next/link";
import { SentimentDot } from "@/components/conversations/ConversationChips";
import { formatRelative, monogram } from "@/components/conversations/format";
import { cn } from "@/lib/utils";

export function ConversationRow({ conversation, active, href, showDeskStatus = false }) {
  const preview =
    conversation.lastMessage?.content || "No messages yet";
  const when =
    conversation.lastMessage?.createdAt || conversation.handoffAt || conversation.startedAt;
  const title =
    showDeskStatus && conversation.waitingForHuman
      ? conversation.agent?.name || "Waiting"
      : conversation.category || conversation.agent?.name || "Conversation";

  return (
    <Link
      href={href}
      className={cn(
        "relative flex gap-3 px-3 py-3 transition-colors",
        active
          ? "bg-[var(--color-primary)]/5"
          : "hover:bg-[var(--color-bg)]"
      )}
    >
      {active ? (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--color-primary)]" />
      ) : null}
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[11px] font-semibold text-[var(--color-primary)]">
        {monogram(conversation.agent?.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-[var(--color-text)]">
            {title}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
            {formatRelative(when)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--color-text-secondary)]">
          {preview}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
          {showDeskStatus && conversation.waitingForHuman ? (
            <span className="rounded-full bg-[var(--color-warning)]/15 px-2 py-0.5 font-medium text-[var(--color-warning)]">
              Waiting
            </span>
          ) : null}
          {showDeskStatus &&
          !conversation.waitingForHuman &&
          conversation.status === "RESOLVED" ? (
            <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 font-medium text-[var(--color-muted)]">
              Resolved
            </span>
          ) : null}
          {showDeskStatus &&
          !conversation.waitingForHuman &&
          conversation.status === "OPEN" &&
          conversation.lastHandoffEndedAt ? (
            <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 font-medium text-[var(--color-primary)]">
              Back to AI
            </span>
          ) : null}
          <SentimentDot value={conversation.sentiment} />
          <span>{conversation.category || "General"}</span>
          <span>·</span>
          <span>{conversation.messageCount || 0} msgs</span>
        </span>
      </span>
    </Link>
  );
}
