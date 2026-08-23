"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getConversation } from "@/lib/api/conversations";
import {
  resolveConversation,
  sendHumanMessage,
  signalHumanTyping,
} from "@/lib/api/desk";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  CategoryChip,
  SentimentChip,
} from "@/components/conversations/ConversationChips";
import {
  formatDayLabel,
  formatFullDate,
  formatRelative,
  monogram,
} from "@/components/conversations/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DESK_EMBED_POLL_MS } from "@/lib/desk/desk-config";

const POLL_MS = DESK_EMBED_POLL_MS;

function groupMessages(messages) {
  const groups = [];
  for (const msg of messages) {
    const day = formatDayLabel(msg.createdAt);
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) {
      groups.push({ day, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  }
  return groups;
}

export function DeskThread({ conversation: initial, onResolved }) {
  const [conversation, setConversation] = useState(initial);
  const [messages, setMessages] = useState(initial.messages || []);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const lastTypingPing = useRef(0);

  const waiting = conversation.waitingForHuman || conversation.status === "WAITING_HUMAN";
  const groups = groupMessages(messages);

  const refresh = useCallback(async () => {
    try {
      const data = await getConversation(conversation.id);
      setConversation(data);
      setMessages(data.messages || []);
    } catch {
      // keep last good state during poll
    }
  }, [conversation.id]);

  useEffect(() => {
    setConversation(initial);
    setMessages(initial.messages || []);
    setError("");
  }, [initial]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [waiting, refresh]);

  function handleComposerChange(text) {
    if (!waiting || !String(text || "").trim()) return;
    const now = Date.now();
    if (now - lastTypingPing.current < 1500) return;
    lastTypingPing.current = now;
    signalHumanTyping(conversation.id).catch(() => {});
  }

  async function sendHuman(text) {
    if (!waiting || sending) return;
    setSending(true);
    setError("");

    const optimisticId = `local-human-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: "HUMAN",
        content: text,
        createdAt: new Date().toISOString(),
        local: true,
      },
    ]);

    try {
      const result = await sendHumanMessage(conversation.id, text);
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimisticId);
        return [
          ...without,
          {
            id: result.message.id,
            role: result.message.role,
            content: result.message.content,
            createdAt: result.message.createdAt,
          },
        ];
      });
      setSending(false);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(err.message || "Unable to send reply");
      setSending(false);
    }
  }

  async function resolve(resumeAi) {
    setResolving(true);
    setError("");
    try {
      const result = await resolveConversation(conversation.id, { resumeAi });
      setConversation((prev) => ({ ...prev, ...result }));
      onResolved?.(result);
      setResolving(false);
    } catch (err) {
      setError(err.message || "Unable to resolve");
      setResolving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/inbox"
              className="text-[12px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] md:hidden"
            >
              ← Inbox
            </Link>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[11px] font-semibold text-[var(--color-primary)]">
              {monogram(conversation.agent?.name)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-[var(--color-text)]">
                {conversation.agent?.name || "Agent"}
              </h1>
              <p className="text-[12px] text-[var(--color-muted)]">
                {waiting
                  ? `Waiting since ${formatRelative(conversation.handoffAt || conversation.startedAt)}`
                  : `Started ${formatFullDate(conversation.startedAt)}`}
              </p>
            </div>
          </div>
          {waiting ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resolving}
                onClick={() => resolve(false)}
              >
                Resolve & close
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={resolving}
                onClick={() => resolve(true)}
              >
                Return to AI
              </Button>
            </div>
          ) : (
            <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)]">
              {conversation.status === "RESOLVED" ? "Resolved" : "AI active"}
            </span>
          )}
        </header>

        {waiting ? (
          <div className="border-b border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-5 py-2 text-[12px] text-[var(--color-text-secondary)]">
            Customer is waiting for a human reply. AI is paused for this thread.
          </div>
        ) : null}

        {conversation.handoffReason ? (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-2 text-[12px] text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-text)]">Handoff reason:</span>{" "}
            {conversation.handoffReason}
          </div>
        ) : null}

        {conversation.handoffSummary ? (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
            <p className="text-[11px] font-medium text-[var(--color-muted)]">
              Context summary
            </p>
            <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
              {conversation.handoffSummary}
            </pre>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6">
            {groups.map((group) => (
              <div key={group.day}>
                <p className="mb-3 text-center text-[11px] font-medium text-[var(--color-muted)]">
                  {group.day}
                </p>
                <div className="flex flex-col gap-3">
                  {group.messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                      responseTime={msg.responseTime}
                      createdAt={msg.createdAt}
                      showMeta
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {waiting ? (
          <>
            {error ? (
              <div className="mx-4 mb-2 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
                {error}
              </div>
            ) : null}
            <ChatComposer
              disabled={sending}
              onSend={sendHuman}
              onValueChange={handleComposerChange}
              compact
              placeholder="Reply as human…"
            />
          </>
        ) : (
          <p className="border-t border-[var(--color-border)] px-5 py-3 text-center text-[12px] text-[var(--color-muted)]">
            This thread is not waiting for human support.
            {conversation.agentId ? (
              <>
                {" "}
                <Link
                  href={`/agents/${conversation.agentId}/conversations/${conversation.id}`}
                  className="font-medium text-[var(--color-primary)] underline"
                >
                  Open in agent inbox
                </Link>
              </>
            ) : null}
          </p>
        )}
      </div>

      <aside className="hidden w-[280px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] xl:flex">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--color-text)]">
            Desk details
          </h2>
        </div>
        <dl className="space-y-4 px-4 py-4 text-[13px]">
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">Status</dt>
            <dd className="mt-1 font-medium text-[var(--color-text)]">
              {conversation.status?.replace("_", " ") || "OPEN"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">Topic</dt>
            <dd className="mt-1">
              <CategoryChip value={conversation.category} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">Sentiment</dt>
            <dd className="mt-1">
              <SentimentChip value={conversation.sentiment} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">Messages</dt>
            <dd className="mt-1 text-[var(--color-text)]">{messages.length}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export function DeskEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-[var(--color-text)]">
        Select a waiting conversation
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-[var(--color-muted)]">
        Threads appear here when a customer requests human support from your embed widget.
      </p>
    </div>
  );
}
