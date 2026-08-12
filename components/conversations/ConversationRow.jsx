"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ConversationRow({ conversation }) {
  return (
    <Link
      href={`/conversations/${conversation.id}`}
      className={cn(
        "block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-sm transition",
        "hover:-translate-y-0.5 hover:border-[var(--color-primary)]/25 hover:shadow-md"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-text)]">
          {conversation.agent?.name || "Agent"}
        </h3>
        <p className="text-xs text-[var(--color-muted)]">
          {formatDate(conversation.startedAt)}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-[var(--color-muted)]">
        <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-0.5">
          {conversation.category || "UNCLASSIFIED"}
        </span>
        <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-0.5">
          {conversation.sentiment || "—"}
        </span>
        <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-0.5">
          {conversation.messageCount} messages
        </span>
      </div>
    </Link>
  );
}
