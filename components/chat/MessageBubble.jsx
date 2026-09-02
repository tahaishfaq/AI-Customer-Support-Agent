"use client";

import ReactMarkdown from "react-markdown";
import { ThumbsUp } from "lucide-react";
import { useState } from "react";
import { ChatAttachmentPreview } from "@/components/chat/ChatAttachmentPreview";
import { ActionConfirmCard } from "@/components/chat/ActionConfirmCard";
import { AvatarImage } from "@/components/ui/avatar-image";
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
      <AvatarImage
        src={identity.avatarUrl}
        size={24}
        className={cn("shrink-0 rounded-full", className)}
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
  streaming = false,
  createdAt,
  showMeta = false,
  themed = false,
  showFeedback = false,
  identity = null,
  messageId,
  initialFeedback = null,
  initialFeedbackReason = null,
  onFeedback,
  usedKnowledge = null,
  toolSteps = null,
  pendingConfirmations = null,
  onConfirmDecision = null,
  confirmBusy = false,
}) {
  const isUser = role === "USER";
  const isHuman = role === "HUMAN";
  const isInternal = role === "INTERNAL";
  const [feedback, setFeedback] = useState(initialFeedback);
  const [reason, setReason] = useState(initialFeedbackReason || "");
  const [askReason, setAskReason] = useState(false);
  const isUp = feedback === "up" || feedback === "UP";
  const isDown = feedback === "down" || feedback === "DOWN";
  const REASON_MAX = 200;
  const showAgentAvatar = themed && !isUser && identity;
  const knowledgeTitles = Array.isArray(usedKnowledge)
    ? usedKnowledge.map((d) => d?.name).filter(Boolean)
    : [];
  const toolLabels = Array.isArray(toolSteps)
    ? toolSteps
        .map((s) => {
          if (!s?.name) return null;
          const ok = s.status === "OK";
          const code = s.httpStatus != null ? String(s.httpStatus) : s.status;
          return ok ? `${s.name} → ${code}` : `${s.name} → ${s.status || "error"}`;
        })
        .filter(Boolean)
    : [];
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
        "animate-message-in flex w-full flex-col gap-1",
        isInternal ? "items-stretch" : isUser ? "items-end" : "items-start"
      )}
    >
      {isInternal ? (
        <div className="mx-auto w-full max-w-[92%] rounded-lg border border-dashed border-amber-500/35 bg-amber-500/8 px-3 py-2.5 text-sm leading-relaxed text-foreground">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/90">
            Internal note · not visible to customer
          </p>
          <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">
            {bodyText || content}
          </p>
          {showMeta && !pending ? (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {formatClock(createdAt)}
            </p>
          ) : null}
        </div>
      ) : (
      <>
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
            {isHuman ? "H" : "AI"}
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
                : "rounded-bl-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
          )}
          style={{
            borderRadius: themed ? "var(--wc-radius)" : undefined,
          }}
        >
          {pending && !streaming ? (
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
                  <p className="whitespace-pre-wrap">
                    {bodyText}
                    {streaming ? (
                      <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle opacity-70" />
                    ) : null}
                  </p>
                ) : (
                  <div className="markdown-body">
                    <ReactMarkdown components={markdownComponents}>
                      {bodyText}
                    </ReactMarkdown>
                    {streaming ? (
                      <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle opacity-70" />
                    ) : null}
                  </div>
                )
              ) : streaming ? (
                <span className="inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle opacity-70" />
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

      {!isUser && !pending && knowledgeTitles.length > 0 ? (
        <p
          className={cn(
            "max-w-[85%] text-[11px] leading-snug sm:max-w-[75%]",
            showAgentAvatar ? "ml-8" : "ml-1",
            themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
          )}
        >
          <span className="font-medium text-[var(--color-primary)]">
            Used knowledge:
          </span>{" "}
          {knowledgeTitles.join(" · ")}
        </p>
      ) : null}

      {!isUser && !pending && toolLabels.length > 0 ? (
        <p
          className={cn(
            "max-w-[85%] text-[11px] leading-snug sm:max-w-[75%]",
            showAgentAvatar ? "ml-8" : "ml-1",
            themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
          )}
        >
          <span className="font-medium text-[var(--color-primary)]">
            Called:
          </span>{" "}
          {toolLabels.join(" · ")}
        </p>
      ) : null}

      {!isUser &&
      !pending &&
      Array.isArray(pendingConfirmations) &&
      pendingConfirmations.length > 0
        ? pendingConfirmations.map((c) => (
            <div
              key={c.id}
              className={cn(showAgentAvatar ? "ml-8" : "ml-1", "w-full")}
            >
              <ActionConfirmCard
                confirmation={c}
                themed={themed}
                busy={confirmBusy}
                onDecision={onConfirmDecision}
              />
            </div>
          ))
        : null}

      {!isUser && !pending && showFeedback && role === "ASSISTANT" ? (
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
              setAskReason(false);
              setReason("");
              onFeedback?.(messageId, "UP");
            }}
            className={cn(
              "rounded p-1 hover:bg-black/5",
              isUp && "text-[var(--wc-primary,var(--color-primary))]"
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
              setAskReason(true);
              onFeedback?.(messageId, "DOWN");
            }}
            className={cn(
              "rounded p-1 hover:bg-black/5",
              isDown && "text-[var(--wc-primary,var(--color-primary))]"
            )}
            aria-label="Not helpful"
            title="Not helpful"
          >
            <ThumbsUp className="size-3.5 rotate-180" />
          </button>
        </div>
      ) : null}

      {askReason && role === "ASSISTANT" && !pending ? (
        <div
          className={cn(
            "w-full max-w-[min(100%,20rem)] space-y-1.5",
            showAgentAvatar ? "ml-8" : "ml-1"
          )}
        >
          <p
            className={cn(
              "text-[11px]",
              themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
            )}
          >
            What was unhelpful? Optional.
          </p>
          <textarea
            value={reason}
            maxLength={REASON_MAX}
            rows={2}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Missing info, wrong answer…"
            className={cn(
              "w-full resize-none rounded-lg px-2.5 py-1.5 text-[12px] outline-none",
              themed
                ? "border border-[var(--wc-border,rgba(0,0,0,0.08))] bg-[var(--wc-chat-bg,#fff)] text-[var(--wc-shell-fg)]"
                : "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
            )}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAskReason(false)}
              className={cn(
                "text-[11px]",
                themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
              )}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmed = reason.trim().slice(0, REASON_MAX);
                onFeedback?.(messageId, "DOWN", trimmed || undefined);
                setAskReason(false);
              }}
              className="rounded-md px-2 py-0.5 text-[11px] font-medium text-[var(--wc-primary,var(--color-primary))]"
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
      </>
      )}
    </div>
  );
}
