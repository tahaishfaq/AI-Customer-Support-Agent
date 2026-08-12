"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAgents } from "@/lib/api/agents";
import { listConversations } from "@/lib/api/conversations";
import { ConversationRow } from "@/components/conversations/ConversationRow";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function ConversationsPage() {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listAgents()
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setOffset(0);
      try {
        const data = await listConversations({
          agentId: agentId || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (cancelled) return;
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load conversations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const nextOffset = offset + PAGE_SIZE;
      const data = await listConversations({
        agentId: agentId || undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setConversations((prev) => [...prev, ...(data.conversations || [])]);
      setTotal(data.total || 0);
      setOffset(nextOffset);
    } catch (err) {
      setError(err.message || "Unable to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="animate-fade-up mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-primary)]">
            History
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            Conversations
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Review past chats, categories, and sentiment.
          </p>
        </div>
        <Link href="/chat" className={cn(buttonVariants({ size: "sm" }))}>
          Open chat
        </Link>
      </div>

      <div className="animate-fade-up-delay-1 mb-5">
        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">
            Filter by agent
          </span>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="h-10 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p
          className="mb-4 rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl bg-[var(--color-border)]" />
          <Skeleton className="h-24 w-full rounded-2xl bg-[var(--color-border)]" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-14 text-center shadow-sm">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-text)]">
            No conversations yet
          </p>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Start a chat to see history here.
          </p>
          <Link
            href="/chat"
            className={cn(buttonVariants(), "mt-6 inline-flex")}
          >
            Start chatting
          </Link>
        </div>
      ) : (
        <div className="animate-fade-up-delay-2 space-y-3">
          {conversations.map((c) => (
            <ConversationRow key={c.id} conversation={c} />
          ))}
          {conversations.length < total ? (
            <div className="pt-2 text-center">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
