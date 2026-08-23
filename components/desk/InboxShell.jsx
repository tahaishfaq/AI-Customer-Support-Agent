"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Headphones, Search } from "lucide-react";
import { listInbox, getDeskStats } from "@/lib/api/desk";
import { ConversationRow } from "@/components/conversations/ConversationRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DESK_INBOX_POLL_MS } from "@/lib/desk/desk-config";

const PAGE_SIZE = 20;
const LIST_POLL_MS = DESK_INBOX_POLL_MS;

const STATUS_FILTERS = [
  { id: "WAITING_HUMAN", label: "Waiting" },
  { id: "ALL", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "RESOLVED", label: "Resolved" },
];

export function InboxShell({ selectedId, children }) {
  const [status, setStatus] = useState("WAITING_HUMAN");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState(null);

  const hideListOnMobile = Boolean(selectedId);

  useEffect(() => {
    let cancelled = false;
    getDeskStats(7)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setOffset(0);
      try {
        const data = await listInbox({
          status,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (cancelled) return;
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load inbox");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status, reloadKey]);

  useEffect(() => {
    if (status !== "WAITING_HUMAN") return undefined;
    const id = setInterval(async () => {
      try {
        const data = await listInbox({
          status,
          limit: PAGE_SIZE,
          offset: 0,
        });
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
      } catch {
        // keep last list
      }
    }, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [status]);

  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const nextOffset = offset + PAGE_SIZE;
      const data = await listInbox({
        status,
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
      if (!q) return true;
      const hay = `${c.agent?.name || ""} ${c.lastMessage?.content || ""} ${c.handoffReason || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, query]);

  return (
    <div className="flex h-[min(calc(100dvh-8rem),820px)] min-h-[520px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-card)]">
      <aside
        className={cn(
          "min-h-0 w-full shrink-0 flex-col border-[var(--color-border)] bg-[var(--color-surface)] md:flex md:w-[340px] md:border-r xl:w-[380px]",
          hideListOnMobile ? "hidden md:flex" : "flex"
        )}
      >
        <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Headphones className="size-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                Human desk
              </h2>
              <p className="text-[12px] text-[var(--color-muted)]">
                {loading
                  ? "Loading…"
                  : `${total} thread${total === 1 ? "" : "s"}`}
                {stats ? (
                  <span className="hidden sm:inline">
                    {" "}
                    · {stats.handoffsInRange} handoffs ({stats.days}d)
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inbox…"
              aria-label="Search inbox"
              className="h-8 border-[var(--color-border)] bg-[var(--color-bg)] pl-8 shadow-none"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatus(item.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  status === item.id
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

        {stats?.queueWarning ? (
          <div className="border-b border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-2 text-[12px] text-[var(--color-text-secondary)]">
            High queue: {stats.waiting} conversations waiting (soft cap{" "}
            {stats.softCap}). Reply to oldest threads first.
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
              <p className="text-sm font-medium text-[var(--color-text)]">
                {status === "WAITING_HUMAN"
                  ? "No conversations waiting for you."
                  : "No conversations in this filter."}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                {status === "WAITING_HUMAN"
                  ? "Customers can tap “Talk to a human” on your embed widget."
                  : status === "RESOLVED"
                    ? "Threads you closed or returned to AI will show up here."
                    : status === "OPEN"
                      ? "Desk threads currently on AI (including after Return to AI) show here."
                      : "Handoff threads from your embed widget will appear here."}
              </p>
            </div>
          ) : (
            <>
              {filtered.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  href={`/inbox/${c.id}`}
                  active={c.id === selectedId}
                  showDeskStatus
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
