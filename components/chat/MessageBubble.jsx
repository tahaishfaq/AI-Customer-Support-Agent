"use client";

import { cn } from "@/lib/utils";

function formatResponseTime(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function MessageBubble({ role, content, responseTime, pending }) {
  const isUser = role === "USER";

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
          isUser
            ? "bg-[var(--color-primary)] text-white"
            : "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
        )}
      >
        {pending ? (
          <span className="inline-flex items-center gap-1 py-1" aria-label="Assistant is typing">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-muted)]" />
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-muted)] [animation-delay:150ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-muted)] [animation-delay:300ms]" />
          </span>
        ) : (
          <p className="whitespace-pre-wrap">{content}</p>
        )}
        {!isUser && !pending && responseTime != null ? (
          <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
            {formatResponseTime(responseTime)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
