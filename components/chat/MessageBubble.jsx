"use client";

import ReactMarkdown from "react-markdown";
import { ThumbsUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function formatResponseTime(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatClock(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const markdownComponents = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium underline underline-offset-2"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <p className="mb-2 text-base font-semibold">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="mb-2 text-sm font-semibold">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="mb-1.5 text-sm font-semibold">{children}</p>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/5 px-1 py-0.5 text-[12px]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-black/5 p-2 text-[12px] last:mb-0">
      {children}
    </pre>
  ),
};

export function MessageBubble({
  role,
  content,
  responseTime,
  pending,
  createdAt,
  showMeta = false,
  themed = false,
  showFeedback = false,
}) {
  const isUser = role === "USER";
  const [feedback, setFeedback] = useState(null);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "flex w-full gap-2",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {!isUser && showMeta ? (
          <span
            className={cn(
              "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
              themed
                ? "bg-[var(--wc-primary)]/15 text-[var(--wc-primary)]"
                : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
            )}
          >
            AI
          </span>
        ) : null}
        <div
          className={cn(
            "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
            isUser
              ? themed
                ? "rounded-br-md bg-[var(--wc-primary)] text-white"
                : "rounded-br-md bg-[var(--color-primary)] text-white"
              : themed
                ? "rounded-bl-md border border-[var(--wc-border)] bg-[var(--wc-assistant-bg)] text-[var(--wc-assistant-fg)]"
                : "rounded-bl-md border border-[var(--color-border)] bg-white text-[var(--color-text)]"
          )}
          style={{
            borderRadius: themed ? "var(--wc-radius)" : undefined,
          }}
        >
          {pending ? (
            <span
              className="inline-flex items-center gap-1 py-1"
              aria-label="Assistant is typing"
            >
              <span
                className={cn(
                  "size-1.5 animate-pulse rounded-full",
                  themed ? "bg-[var(--wc-muted)]" : "bg-[var(--color-muted)]"
                )}
              />
              <span
                className={cn(
                  "size-1.5 animate-pulse rounded-full [animation-delay:150ms]",
                  themed ? "bg-[var(--wc-muted)]" : "bg-[var(--color-muted)]"
                )}
              />
              <span
                className={cn(
                  "size-1.5 animate-pulse rounded-full [animation-delay:300ms]",
                  themed ? "bg-[var(--wc-muted)]" : "bg-[var(--color-muted)]"
                )}
              />
            </span>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown components={markdownComponents}>
                {content || ""}
              </ReactMarkdown>
            </div>
          )}
          {showMeta && !pending ? (
            <p
              className={cn(
                "mt-1.5 text-[10px]",
                isUser
                  ? "text-white/70"
                  : themed
                    ? "text-[var(--wc-muted)]"
                    : "text-[var(--color-muted)]"
              )}
            >
              {formatClock(createdAt)}
              {!isUser && responseTime != null
                ? ` · ${formatResponseTime(responseTime)}`
                : ""}
            </p>
          ) : !isUser && !pending && responseTime != null ? (
            <p
              className={cn(
                "mt-1.5 text-[11px]",
                themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
              )}
            >
              {formatResponseTime(responseTime)}
            </p>
          ) : null}
        </div>
        {isUser && showMeta ? (
          <span
            className={cn(
              "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
              themed ? "bg-[var(--wc-primary)]" : "bg-[var(--color-primary)]"
            )}
          >
            Y
          </span>
        ) : null}
      </div>

      {!isUser && !pending && showFeedback ? (
        <div
          className={cn(
            "ml-1 flex gap-1",
            themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
          )}
        >
          <button
            type="button"
            onClick={() => setFeedback("up")}
            className={cn(
              "rounded p-1 hover:bg-black/5",
              feedback === "up" && "text-[var(--wc-primary,var(--color-primary))]"
            )}
            aria-label="Helpful"
            title="Helpful"
          >
            <ThumbsUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFeedback("down")}
            className={cn(
              "rounded p-1 hover:bg-black/5",
              feedback === "down" &&
                "text-[var(--wc-primary,var(--color-primary))]"
            )}
            aria-label="Not helpful"
            title="Not helpful"
          >
            <ThumbsUp className="size-3.5 rotate-180" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
