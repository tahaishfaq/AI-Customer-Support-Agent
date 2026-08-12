"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getConversation } from "@/lib/api/conversations";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function ConversationDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getConversation(id);
        if (!cancelled) setConversation(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load conversation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Skeleton className="h-8 w-48 bg-[var(--color-border)]" />
        <Skeleton className="mt-6 h-80 w-full rounded-3xl bg-[var(--color-border)]" />
      </main>
    );
  }

  if (error || !conversation) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-sm text-[var(--color-danger)]">
          {error || "Conversation not found"}
        </p>
        <Link
          href="/conversations"
          className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] underline"
        >
          Back to conversations
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="animate-fade-up">
        <Link
          href="/conversations"
          className="text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
        >
          ← Back to conversations
        </Link>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="border-b border-[var(--color-border)] px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-primary)]">
                  Conversation
                </p>
                <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                  {conversation.agent?.name || "Agent"}
                </h1>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Started {formatDate(conversation.startedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)]">
                  {conversation.category || "UNCLASSIFIED"}
                </span>
                <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)]">
                  {conversation.sentiment || "—"}
                </span>
                <Link
                  href={`/chat?agentId=${conversation.agentId}`}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Chat with agent
                </Link>
              </div>
            </div>
          </div>

          <div className="flex max-h-[min(65vh,560px)] flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6">
            {(conversation.messages || []).map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                responseTime={msg.responseTime}
              />
            ))}
            {(conversation.messages || []).length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No messages in this conversation.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
