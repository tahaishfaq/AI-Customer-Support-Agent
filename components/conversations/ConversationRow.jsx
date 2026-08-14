"use client";

import Link from "next/link";
import { SentimentDot } from "@/components/conversations/ConversationChips";
import { formatRelative, monogram } from "@/components/conversations/format";
import { cn } from "@/lib/utils";

export function ConversationRow({ conversation, active }) {
  const preview =
    conversation.lastMessage?.content || "No messages yet";
  const when =
    conversation.lastMessage?.createdAt || conversation.startedAt;

  return (
    <Link
      href={`/conversations/${conversation.id}`}
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
            {conversation.agent?.name || "Agent"}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
            {formatRelative(when)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--color-text-secondary)]">
          {preview}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
          <SentimentDot value={conversation.sentiment} />
          <span>{conversation.category || "General"}</span>
          <span>·</span>
          <span>{conversation.messageCount || 0} msgs</span>
        </span>
      </span>
    </Link>
  );
}
