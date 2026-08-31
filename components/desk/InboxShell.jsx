"use client";

import { useEffect, useMemo, useState } from "react";
import { Headphones, Inbox, Search } from "lucide-react";
import { listInbox, getDeskStats, markInboxSeen } from "@/lib/api/desk";
import { ConversationRow } from "@/components/conversations/ConversationRow";
import {
  SoftStagger,
  SoftStaggerItem,
} from "@/components/motion/soft-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { DESK_INBOX_POLL_MS } from "@/lib/desk/desk-config";
import { DESK_INBOX_SEEN_EVENT } from "@/hooks/use-desk-waiting-count";

const PAGE_SIZE = 20;
const LIST_POLL_MS = DESK_INBOX_POLL_MS;

/** Botpress-style folders → API status filter */
const FOLDERS = [
  { id: "WAITING_HUMAN", label: "My Inbox", short: "Inbox" },
  { id: "ALL", label: "All", short: "All" },
  { id: "OPEN", label: "Open", short: "Open" },
  { id: "RESOLVED", label: "Resolved", short: "Done" },
];

const PRIORITY_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "URGENT", label: "Urgent" },
  { id: "HIGH", label: "High" },
  { id: "NORMAL", label: "Normal" },
];

export function InboxShell({ selectedId, children }) {
  const [status, setStatus] = useState("WAITING_HUMAN");
  const [priority, setPriority] = useState("ALL");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState(null);
  const [markingRead, setMarkingRead] = useState(false);

  const hideListOnMobile = Boolean(selectedId);

  async function markAllRead() {
    setMarkingRead(true);
    setError("");
    try {
      const data = await markInboxSeen();
      window.dispatchEvent(
        new CustomEvent(DESK_INBOX_SEEN_EVENT, { detail: data })
      );
    } catch (err) {
      setError(err.message || "Unable to mark inbox as read");
    } finally {
      setMarkingRead(false);
    }
  }

  useEffect(() => {
    markInboxSeen()
      .then((data) =>
        window.dispatchEvent(
          new CustomEvent(DESK_INBOX_SEEN_EVENT, { detail: data })
        )
      )
      .catch(() => {});
  }, []);

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
          priority,
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
  }, [status, priority, reloadKey]);

  useEffect(() => {
    if (status !== "WAITING_HUMAN") return undefined;
    const id = setInterval(async () => {
      try {
        const data = await listInbox({
          status,
          priority,
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
  }, [status, priority]);

  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const nextOffset = offset + PAGE_SIZE;
      const data = await listInbox({
        status,
        priority,
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
      const hay =
        `${c.agent?.name || ""} ${c.lastMessage?.content || ""} ${c.handoffReason || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, query]);

  function folderCount(folderId) {
    if (!stats) return null;
    if (folderId === "WAITING_HUMAN") return stats.waiting;
    if (folderId === "RESOLVED") return stats.resolvedInRange;
    if (folderId === "ALL" && status === "ALL") return total;
    return null;
  }

  return (
    <div className="flex h-[min(calc(100dvh-7.5rem),860px)] min-h-[min(100%,520px)] overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
      <aside
        className={cn(
          "min-h-0 w-full shrink-0 flex-col border-border bg-card md:flex md:w-[340px] md:border-r xl:w-[380px]",
          hideListOnMobile ? "hidden md:flex" : "flex"
        )}
      >
        <div className="shrink-0 border-b border-border/70 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Headphones className="size-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                  Human desk
                </h2>
                <p className="text-xs text-muted-foreground">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-full text-[11px]"
              disabled={markingRead}
              onClick={markAllRead}
            >
              {markingRead ? <Spinner data-icon="inline-start" /> : null}
              {markingRead ? "Marking…" : "Read all"}
            </Button>
          </div>

          <InputGroup className="mt-3 h-9 rounded-full">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inbox…"
              aria-label="Search inbox"
            />
          </InputGroup>

          <nav
            className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-0.5 md:flex-col md:overflow-visible md:pb-0"
            aria-label="Inbox folders"
          >
            {FOLDERS.map((item) => {
              const active = status === item.id;
              const count = folderCount(item.id);
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setStatus(item.id)}
                  className={cn(
                    "h-8 shrink-0 justify-between rounded-full px-3 md:w-full md:rounded-lg md:px-2.5",
                    active && "bg-muted shadow-sm ring-1 ring-border"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {item.id === "WAITING_HUMAN" ? (
                      <Inbox className="size-3.5 text-muted-foreground" />
                    ) : null}
                    <span className="md:hidden">{item.short}</span>
                    <span className="hidden md:inline">{item.label}</span>
                  </span>
                  {count != null ? (
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="rounded-full"
                    >
                      {count}
                    </Badge>
                  ) : null}
                </Button>
              );
            })}
          </nav>

          <div
            className="mt-2 flex flex-wrap gap-1"
            role="group"
            aria-label="Priority filter"
          >
            {PRIORITY_FILTERS.map((item) => {
              const active = priority === item.id;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPriority(item.id)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-[11px]",
                    active && "bg-muted shadow-sm ring-1 ring-border"
                  )}
                >
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive" className="m-3">
            <AlertTitle>Could not load inbox</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>{error}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {stats?.queueWarning ? (
          <Alert className="mx-3 mt-3 border-amber-500/30 bg-amber-500/10">
            <AlertTitle>High queue</AlertTitle>
            <AlertDescription>
              {stats.waiting} conversations waiting (soft cap {stats.softCap}).
              Reply to oldest threads first.
            </AlertDescription>
          </Alert>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="divide-y divide-border/60">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 px-4 py-3.5">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              className="m-3 rounded-xl border border-dashed border-border/70 bg-muted/20 py-12"
              icon={Inbox}
              title={
                status === "WAITING_HUMAN"
                  ? "Inbox zero"
                  : "No conversations here"
              }
              description={
                status === "WAITING_HUMAN"
                  ? "Customers appear here when they ask to talk to a person."
                  : status === "RESOLVED"
                    ? "Threads you closed or returned to AI show here."
                    : status === "OPEN"
                      ? "Desk threads currently on AI show here."
                      : "Handoff threads from your embed widget will appear here."
              }
              action={
                status !== "WAITING_HUMAN" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStatus("WAITING_HUMAN")}
                  >
                    Open My Inbox
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <SoftStagger className="divide-y divide-border/50">
                {filtered.map((c) => (
                  <SoftStaggerItem key={c.id}>
                    <ConversationRow
                      conversation={c}
                      href={`/inbox/${c.id}`}
                      active={c.id === selectedId}
                      showDeskStatus
                    />
                  </SoftStaggerItem>
                ))}
              </SoftStagger>
              {conversations.length < total ? (
                <div className="p-3 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={loadingMore}
                    onClick={loadMore}
                  >
                    {loadingMore ? (
                      <Spinner data-icon="inline-start" />
                    ) : null}
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </ScrollArea>
      </aside>

      <section
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col bg-background",
          hideListOnMobile ? "flex" : "hidden md:flex"
        )}
      >
        {children}
      </section>
    </div>
  );
}
