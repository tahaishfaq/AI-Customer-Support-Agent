"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";
import { listConversations } from "@/lib/api/conversations";
import { ConversationRow } from "@/components/conversations/ConversationRow";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const SENTIMENT_FILTERS = [
  { id: "", label: "All" },
  { id: "POSITIVE", label: "Positive" },
  { id: "NEGATIVE", label: "Negative" },
  { id: "NEUTRAL", label: "Neutral" },
];

export function ConversationsShell({
  selectedId,
  children,
  agentId,
  inboxBase,
  listFn,
  showNewChat = true,
  newChatHref: newChatHrefProp,
  emptyHint,
}) {
  const [sentiment, setSentiment] = useState("");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const fetchList = listFn || listConversations;
  const inboxHref = inboxBase || `/agents/${agentId}/conversations`;
  const newChatHref = newChatHrefProp || `/agents/${agentId}/test`;
  const hideListOnMobile = Boolean(selectedId);

  useEffect(() => {
    if (!agentId) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setOffset(0);
      try {
        const data = await fetchList({
          agentId,
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
  }, [agentId, fetchList, reloadKey]);

  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const nextOffset = offset + PAGE_SIZE;
      const data = await fetchList({
        agentId,
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (sentiment && c.sentiment !== sentiment) return false;
      if (!q) return true;
      const hay = `${c.category || ""} ${c.lastMessage?.content || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, query, sentiment]);

  return (
    <div className="flex h-[min(72dvh,760px)] min-h-[480px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-card)]">
      <aside
        className={cn(
          "min-h-0 w-full shrink-0 flex-col border-[var(--color-border)] bg-[var(--color-surface)] md:flex md:w-[340px] md:border-r xl:w-[380px]",
          hideListOnMobile ? "hidden md:flex" : "flex"
        )}
      >
        <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                Inbox
              </h2>
              <p className="text-[12px] text-[var(--color-muted)]">
                {loading
                  ? "Loading…"
                  : `${total} conversation${total === 1 ? "" : "s"}`}
              </p>
            </div>
            {showNewChat ? (
              <Link href={newChatHref} className={cn(buttonVariants({ size: "sm" }))}>
                New chat
              </Link>
            ) : null}
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this agent…"
              aria-label="Search conversations"
              className="h-8 border-[var(--color-border)] bg-[var(--color-bg)] pl-8 shadow-none"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {SENTIMENT_FILTERS.map((item) => (
              <button
                key={item.id || "all"}
                type="button"
                onClick={() => setSentiment(item.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  sentiment === item.id
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="px-4 py-2" role="alert">
            <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-1 text-[12px] font-medium text-[var(--color-primary)] underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 px-4 py-3">
                  <Skeleton className="size-10 rounded-full bg-[var(--color-border)]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-2/3 bg-[var(--color-border)]" />
                    <Skeleton className="h-3 w-full bg-[var(--color-border)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <MessageSquare className="size-4" />
              </span>
              <p className="mt-3 text-sm font-medium text-[var(--color-text)]">
                {conversations.length === 0
                  ? emptyHint || "No conversations yet. Start a test chat."
                  : "No conversations match these filters."}
              </p>
              {conversations.length === 0 && showNewChat ? (
                <Link
                  href={newChatHref}
                  className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
                >
                  Start a chat
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              {filtered.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  href={`${inboxHref}/${c.id}`}
                  active={c.id === selectedId}
                />
              ))}
              {conversations.length < total ? (
                <div className="p-3 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={loadMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </aside>

      <section
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col",
          hideListOnMobile ? "flex" : "hidden md:flex"
        )}
      >
        {children}
      </section>
    </div>
  );
}
