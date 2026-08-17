"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { sendChatMessage } from "@/lib/api/chat";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  CategoryChip,
  SentimentChip,
} from "@/components/conversations/ConversationChips";
import {
  formatDayLabel,
  formatFullDate,
  monogram,
} from "@/components/conversations/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export function ConversationThread({ conversation, onUpdated }) {
  const [messages, setMessages] = useState(conversation.messages || []);
  const [meta, setMeta] = useState({
    category: conversation.category,
    sentiment: conversation.sentiment,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [lastFailedText, setLastFailedText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages(conversation.messages || []);
    setMeta({
      category: conversation.category,
      sentiment: conversation.sentiment,
    });
    setError("");
    setLastFailedText("");
  }, [conversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const groups = groupMessages(messages);
  const agentId = conversation.agentId;

  async function send(text) {
    if (!agentId || sending) return;
    setSending(true);
    setError("");
    setLastFailedText("");

    const optimisticId = `local-user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: "USER",
        content: text,
        createdAt: new Date().toISOString(),
        local: true,
      },
    ]);

    try {
      const result = await sendChatMessage(agentId, {
        message: text,
        conversationId: conversation.id,
      });

      setMeta({
        category: result.category ?? meta.category,
        sentiment: result.sentiment ?? meta.sentiment,
      });

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutOptimistic,
          {
            id: result.userMessage.id,
            role: result.userMessage.role,
            content: result.userMessage.content,
            createdAt: result.userMessage.createdAt,
          },
          {
            id: result.message.id,
            role: result.message.role,
            content: result.message.content,
            responseTime: result.message.responseTime,
            createdAt: result.message.createdAt,
          },
        ];
      });

      onUpdated?.({
        conversationId: conversation.id,
        category: result.category,
        sentiment: result.sentiment,
        lastMessage: {
          content: text,
          role: "USER",
        },
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(err.message || "Unable to send message");
      setLastFailedText(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/agents/${agentId}/conversations`}
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
                Started {formatFullDate(conversation.startedAt)}
              </p>
            </div>
          </div>
          <Link
            href={`/chat?agentId=${agentId}${conversation.id ? `&conversationId=${conversation.id}` : ""}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0"
            )}
          >
            Open in chat
          </Link>
        </header>

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
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
                No messages yet. Send one below to continue this chat.
              </p>
            ) : null}
            {sending ? (
              <p className="text-[12px] text-[var(--color-muted)]">
                Agent is typing…
              </p>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>

        {error ? (
          <div className="mx-4 mb-2 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>{error}</p>
              {lastFailedText ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  onClick={() => send(lastFailedText)}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <ChatComposer
          disabled={sending || !agentId}
          onSend={send}
          compact
        />
      </div>

      <aside className="hidden w-[280px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] xl:flex">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--color-text)]">
            Details
          </h2>
        </div>
        <dl className="space-y-4 px-4 py-4 text-[13px]">
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">
              Agent
            </dt>
            <dd className="mt-1 font-medium text-[var(--color-text)]">
              {conversation.agent?.name || "Agent"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">
              Topic
            </dt>
            <dd className="mt-1">
              <CategoryChip value={meta.category} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">
              Sentiment
            </dt>
            <dd className="mt-1">
              <SentimentChip value={meta.sentiment} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">
              Messages
            </dt>
            <dd className="mt-1 text-[var(--color-text)]">{messages.length}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-[var(--color-muted)]">
              Started
            </dt>
            <dd className="mt-1 text-[var(--color-text)]">
              {formatFullDate(conversation.startedAt)}
            </dd>
          </div>
        </dl>
        <div className="mt-auto border-t border-[var(--color-border)] p-4">
          <p className="mb-2 text-[12px] text-[var(--color-muted)]">
            Reply in this thread below, or open the embed preview.
          </p>
          <Link
            href={`/chat?agentId=${agentId}&conversationId=${conversation.id}`}
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            Open in chat widget
          </Link>
        </div>
      </aside>
    </div>
  );
}

export function ConversationEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
        <MessageSquare className="size-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">
        Select a conversation
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-[var(--color-muted)]">
        Choose a thread from the inbox to read the transcript and keep chatting.
      </p>
    </div>
  );
}
