"use client";

import ReactMarkdown from "react-markdown";
import { Check, Copy, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { ChatAttachmentPreview } from "@/components/chat/ChatAttachmentPreview";
import { ActionConfirmCard } from "@/components/chat/ActionConfirmCard";
import { AvatarImage } from "@/components/ui/avatar-image";
import { Button } from "@/components/ui/button";
import {
  isSourceClarifyAssistantMessage,
  sourceClarifyButtonsFromContent,
} from "@/lib/services/ai/intent-clarify";
import { parseChatAttachment } from "@/lib/utils/chat-attachments";
import { closeStreamingMarkdown } from "@/lib/chat/stream-markdown";
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
  showKnowledgeDetails = false,
  showCopy = false,
  toolSteps = null,
  searchUsed = false,
  citations = null,
  sources = null,
  pendingConfirmations = null,
  onConfirmDecision = null,
  confirmBusy = false,
  showSourceClarifyButtons = false,
  onSourceClarifyReply = null,
  onOpenKnowledge = null,
  /** Live server status ("Thinking…", "Searching the web…") while the reply has no text yet. */
  statusLabel = null,
  /** Owner surfaces show reply latency; the public widget hides it. */
  showResponseTime = true,
}) {
  const isUser = role === "USER";
  const isHuman = role === "HUMAN";
  const isInternal = role === "INTERNAL";
  const [feedback, setFeedback] = useState(initialFeedback);
  const [reason, setReason] = useState(initialFeedbackReason || "");
  const [askReason, setAskReason] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUp = feedback === "up" || feedback === "UP";
  const isDown = feedback === "down" || feedback === "DOWN";
  const REASON_MAX = 200;
  const showAgentAvatar = themed && !isUser && identity;
  const sourceClarifyButtons =
    !isUser &&
    !pending &&
    !streaming &&
    showSourceClarifyButtons &&
    typeof onSourceClarifyReply === "function" &&
    isSourceClarifyAssistantMessage(content)
      ? sourceClarifyButtonsFromContent(content)
      : [];
  const knowledgeTitles = Array.isArray(usedKnowledge)
    ? usedKnowledge.map((d) => d?.name).filter(Boolean)
    : [];
  const knowledgeSources = Array.isArray(usedKnowledge)
    ? usedKnowledge
        .map((source) => {
          const url = String(source?.sourceUrl || "").trim();
          if (!/^https?:\/\//i.test(url)) return null;
          return { name: source?.name || "Knowledge source", url };
        })
        .filter(Boolean)
    : [];
  const sourceChips = [];
  if (knowledgeTitles.length > 0) sourceChips.push("Knowledge");
  const mcpOkSteps = Array.isArray(toolSteps)
    ? toolSteps.filter(
        (s) =>
          String(s?.name || "")
            .toLowerCase()
            .includes("mcp_") &&
          (s?.ok === true || String(s?.status || "").toUpperCase() === "OK")
      )
    : [];
  if (mcpOkSteps.length) {
    const githubish = mcpOkSteps.some((s) =>
      /github/.test(String(s?.name || "").toLowerCase())
    );
    sourceChips.push(githubish ? "Connected GitHub" : "Connected MCP");
  }
  if (searchUsed) sourceChips.push("Online");
  const toolLabels = Array.isArray(toolSteps)
    ? toolSteps
        .map((s) => {
          if (!s?.name) return null;
          const ok = s.status === "OK";
          const waiting =
            String(s.errorCode || "").toUpperCase() === "CONFIRMATION_REQUIRED" ||
            String(s.status || "").toUpperCase() === "CONFIRMATION_REQUIRED";
          if (waiting) return `${s.name} → waiting for confirm`;
          const code = s.httpStatus != null ? String(s.httpStatus) : s.status;
          return ok ? `${s.name} → ${code}` : `${s.name} → ${s.status || "error"}`;
        })
        .filter(Boolean)
    : [];
  const webSources = (Array.isArray(sources) && sources.length
    ? sources
    : Array.isArray(citations)
      ? citations
      : []
  ).filter((source) => source?.url);
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

  async function copyMessage() {
    const text = String(bodyText || content || "").trim();
    if (!text || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const canCopy =
    Boolean(showCopy) &&
    !pending &&
    !streaming &&
    !isInternal &&
    Boolean(String(bodyText || content || "").trim());

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
            "max-w-[85%] rounded-md px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
            isUser
              ? themed
                ? "bg-[var(--wc-primary)] text-white"
                : "bg-orange-600 text-white"
              : themed
                ? "bg-[var(--wc-assistant-bg)] text-[var(--wc-assistant-fg)]"
                : "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
          )}
          style={
            themed
              ? {
                  borderRadius: "var(--wc-radius, 0.75rem)",
                  boxShadow: isUser
                    ? "none"
                    : "0 2px 12px rgba(15, 23, 42, 0.06)",
                }
              : undefined
          }
        >
          {(pending || (streaming && !bodyText)) && !(streaming && bodyText) ? (
            <span
              className="inline-flex flex-col gap-1 py-0.5"
              role="status"
              aria-live="polite"
              aria-label={streaming ? statusLabel || "Thinking…" : "Assistant is typing"}
            >
              <span
                className={cn(
                  "text-[11px] font-medium",
                  themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
                )}
              >
                {streaming ? statusLabel || "Thinking…" : "Typing…"}
              </span>
              <span className="inline-flex items-center gap-1" aria-hidden>
                <span
                  className={cn(
                    "size-1.5 rounded-full motion-safe:animate-pulse",
                    themed ? "bg-[var(--wc-primary)]" : "bg-[var(--color-primary)]"
                  )}
                />
                <span
                  className={cn(
                    "size-1.5 rounded-full motion-safe:animate-pulse [animation-delay:150ms]",
                    themed ? "bg-[var(--wc-primary)]" : "bg-[var(--color-primary)]"
                  )}
                />
                <span
                  className={cn(
                    "size-1.5 rounded-full motion-safe:animate-pulse [animation-delay:300ms]",
                    themed ? "bg-[var(--wc-primary)]" : "bg-[var(--color-primary)]"
                  )}
                />
              </span>
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
                ) : streaming ? (
                  // Same markdown renderer as the final message, so nothing re-lays out on done.
                  <div className="markdown-body aide-streaming-caret">
                    <ReactMarkdown components={markdownComponents}>
                      {closeStreamingMarkdown(bodyText)}
                    </ReactMarkdown>
                  </div>
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
              {!isUser && showResponseTime && responseTime != null
                ? ` · ${formatResponseTime(responseTime)}`
                : ""}
            </p>
          ) : !isUser && !pending && showResponseTime && responseTime != null ? (
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
              themed ? "bg-[var(--wc-primary)]" : "bg-orange-600"
            )}
          >
            Y
          </span>
        ) : null}
      </div>

      {canCopy ? (
        <div
          className={cn(
            "flex max-w-[85%] sm:max-w-[75%]",
            isUser ? "justify-end" : showAgentAvatar ? "ml-8 justify-start" : "ml-1 justify-start"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              themed && "text-[var(--wc-muted)] hover:text-[var(--wc-assistant-fg)]"
            )}
            aria-label={copied ? "Copied" : "Copy message"}
            title={copied ? "Copied" : "Copy message"}
            onClick={copyMessage}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      ) : null}

      {!isUser && !pending && showKnowledgeDetails && knowledgeTitles.length > 0 ? (
        <div
          className={cn(
            "flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]",
            showAgentAvatar ? "ml-8" : "ml-1"
          )}
        >
          <p
            className={cn(
              "text-[11px] leading-snug",
              themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
            )}
          >
            <span className="font-medium text-[var(--color-primary)]">
              Used knowledge:
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5" aria-label="Open used knowledge">
            {(Array.isArray(usedKnowledge) ? usedKnowledge : [])
              .filter((d) => d?.name)
              .map((doc) => {
                const canOpen =
                  typeof onOpenKnowledge === "function" && Boolean(doc.id);
                const label = doc.name;
                if (!canOpen) {
                  return (
                    <span
                      key={doc.id || label}
                      className={cn(
                        "rounded-full border px-2 py-1 text-[11px]",
                        themed
                          ? "border-[var(--wc-border)] text-[var(--wc-muted)]"
                          : "border-[var(--color-border)] text-[var(--color-muted)]"
                      )}
                    >
                      {label}
                    </span>
                  );
                }
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onOpenKnowledge(doc)}
                    className={cn(
                      "max-w-full truncate rounded-full border px-2 py-1 text-left text-[11px] font-medium underline underline-offset-2",
                      themed
                        ? "border-[var(--wc-border)] text-[var(--wc-primary)] hover:bg-[var(--wc-primary)]/5"
                        : "border-[var(--color-border)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                    )}
                    title="Open full indexed knowledge text"
                  >
                    {label}
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}

      {!isUser && !pending && showKnowledgeDetails && sourceChips.length > 0 ? (
        <p
          className={cn(
            "max-w-[85%] text-[11px] leading-snug sm:max-w-[75%]",
            showAgentAvatar ? "ml-8" : "ml-1",
            themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
          )}
        >
          <span className="font-medium text-[var(--color-primary)]">
            Sources:
          </span>{" "}
          {sourceChips.join(" · ")}
        </p>
      ) : null}

      {!isUser && !pending && showKnowledgeDetails && knowledgeSources.length > 0 ? (
        <div
          className={cn(
            "flex max-w-[85%] flex-wrap gap-1.5 sm:max-w-[75%]",
            showAgentAvatar ? "ml-8" : "ml-1"
          )}
          aria-label="Knowledge sources"
        >
          {knowledgeSources.slice(0, 8).map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "max-w-full truncate rounded-full border px-2 py-1 text-[11px] underline underline-offset-2",
                themed
                  ? "border-[var(--wc-border)] text-[var(--wc-muted)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)]"
              )}
              title={source.url}
            >
              {source.name}
            </a>
          ))}
        </div>
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

      {!isUser && !pending && webSources.length > 0 ? (
        <div
          className={cn(
            "flex max-w-[85%] flex-wrap gap-1.5 sm:max-w-[75%]",
            showAgentAvatar ? "ml-8" : "ml-1"
          )}
          aria-label="Web sources"
        >
          {webSources.slice(0, 8).map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "max-w-full truncate rounded-full border px-2 py-1 text-[11px] underline underline-offset-2",
                themed
                  ? "border-[var(--wc-border)] text-[var(--wc-muted)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)]"
              )}
              title={source.title || source.url}
            >
              {source.title || "Web source"}
            </a>
          ))}
        </div>
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

      {sourceClarifyButtons.length > 0 ? (
        <div
          className={cn(
            "flex w-full max-w-[min(100%,22rem)] flex-wrap gap-1.5",
            showAgentAvatar ? "ml-8" : "ml-1"
          )}
          role="group"
          aria-label="Choose where to look"
        >
          {sourceClarifyButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              disabled={confirmBusy}
              onClick={() => onSourceClarifyReply?.(btn.label)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-left text-[12px] font-medium transition-colors",
                themed
                  ? "border-[var(--wc-border)] bg-[var(--wc-shell)] text-[var(--wc-shell-fg)] hover:border-[var(--wc-primary)] hover:text-[var(--wc-primary)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              )}
            >
              <span className="tabular-nums opacity-60">{btn.n}. </span>
              {btn.label}
            </button>
          ))}
        </div>
      ) : null}

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
