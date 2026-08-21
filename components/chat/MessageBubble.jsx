"use client";

import ReactMarkdown from "react-markdown";
import { ThumbsUp } from "lucide-react";
import { useState } from "react";
import { ChatAttachmentPreview } from "@/components/chat/ChatAttachmentPreview";
import { parseChatAttachment } from "@/lib/utils/chat-attachments";
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
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || ""}
      className="mt-1 max-h-40 max-w-full rounded-md object-contain"
    />
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

function AgentMark({ identity, className }) {
  if (identity?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={identity.avatarUrl}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  const letters = (identity?.name || "H")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className
      )}
      style={{ backgroundColor: "var(--wc-primary)" }}
    >
      {letters}
    </span>
  );
}

export function MessageBubble({
  role,
  content,
  responseTime,
  pending,
  createdAt,
  showMeta = false,
  themed = false,
  showFeedback = false,
  identity = null,
  messageId,
  initialFeedback = null,
  onFeedback,
}) {
  const isUser = role === "USER";
  const [feedback, setFeedback] = useState(initialFeedback);
  const showAgentAvatar = themed && !isUser && identity;
  const parsedFile = parseChatAttachment(content);
  const caption = parsedFile.display
    .replace(/!\[[^\]]*\]\(https?:[^)]+\)/g, "")
    .replace(/Attached file:\s*\[[^\]]+\]\(https?:[^)]+\)/gi, "")
    .trim();
  const hasAttachment =
    Boolean(parsedFile.meta) ||
    /!\[[^\]]*\]\(https?:/.test(content || "") ||
    /Attached file:/i.test(content || "");
  const bodyText = hasAttachment ? caption : parsedFile.display || content;

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
        {!isUser && showAgentAvatar ? (
          <AgentMark identity={identity} className="mt-0.5 size-6 text-[9px]" />
        ) : !isUser && showMeta ? (
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
                ? "rounded-bl-md bg-[var(--wc-assistant-bg)] text-[var(--wc-assistant-fg)]"
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
          ) : (
            <div className="space-y-1">
              {hasAttachment ? (
                <ChatAttachmentPreview
                  content={content}
                  themed={themed}
                  isUser={isUser}
                />
              ) : null}
              {bodyText ? (
                isUser && !bodyText.includes("](") && !bodyText.includes("![") ? (
                  <p className="whitespace-pre-wrap">{bodyText}</p>
                ) : (
                  <div className="markdown-body">
                    <ReactMarkdown components={markdownComponents}>
                      {bodyText}
                    </ReactMarkdown>
                  </div>
                )
              ) : null}
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
            "flex gap-1",
            showAgentAvatar ? "ml-8" : "ml-1",
            themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
          )}
        >
          <button
            type="button"
            onClick={() => {
              setFeedback("up");
              onFeedback?.(messageId, "UP");
            }}
            className={cn(
              "rounded p-1 hover:bg-black/5",
              (feedback === "up" || feedback === "UP") &&
                "text-[var(--wc-primary,var(--color-primary))]"
            )}
            aria-label="Helpful"
            title="Helpful"
          >
            <ThumbsUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setFeedback("down");
              onFeedback?.(messageId, "DOWN");
            }}
            className={cn(
              "rounded p-1 hover:bg-black/5",
              (feedback === "down" || feedback === "DOWN") &&
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
