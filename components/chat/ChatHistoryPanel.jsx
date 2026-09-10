"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { listConversations } from "@/lib/api/conversations";
import { formatRelative } from "@/components/conversations/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function previewText(conversation) {
  const text = conversation?.lastMessage?.content?.trim();
  if (text) return text;
  if (conversation?.category) return conversation.category;
  return "No messages yet";
}

export function ChatHistoryPanel({
  agentId,
  activeId,
  onSelect,
  onNewChat,
  refreshKey = 0,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!agentId) {
      setItems([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await listConversations({
          agentId,
          limit: 40,
          offset: 0,
        });
        if (!cancelled) setItems(data.conversations || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load history");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [agentId, refreshKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--wc-chat-bg,#ffffff)] text-[var(--wc-shell-fg,#0f172a)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--wc-border,rgba(15,23,42,0.08))] bg-[var(--wc-shell,#ffffff)] px-3 py-2.5">
        <div>
          <p className="text-[13px] font-semibold text-[var(--wc-shell-fg,#0f172a)]">
            Chat history
          </p>
          <p className="text-[11px] text-[var(--wc-muted,#64748b)]">
            Open a past chat to resume
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 border-[var(--wc-border,rgba(15,23,42,0.08))] bg-transparent text-[var(--wc-shell-fg,#0f172a)] hover:bg-[var(--wc-assistant-bg,#f1f5f9)] hover:text-[var(--wc-assistant-fg,#0f172a)]"
          onClick={onNewChat}
        >
          <Plus className="size-3.5" />
          New
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-14 bg-[var(--wc-border,rgba(148,163,184,0.22))]" />
            <Skeleton className="h-14 bg-[var(--wc-border,rgba(148,163,184,0.22))]" />
            <Skeleton className="h-14 bg-[var(--wc-border,rgba(148,163,184,0.22))]" />
          </div>
        ) : error ? (
          <p className="px-4 py-8 text-center text-[12px] text-red-500 dark:text-red-400">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--wc-primary)]/10 text-[var(--wc-primary)]">
              <MessageSquare className="size-4" />
            </span>
            <p className="mt-3 text-[13px] font-medium text-[var(--wc-shell-fg,#0f172a)]">
              No chats yet
            </p>
            <p className="mt-1 text-[12px] text-[var(--wc-muted,#64748b)]">
              Start a new conversation to see it here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2 p-3">
            {items.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "flex w-full flex-col gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-primary)]/45",
                      active
                        ? "border-[var(--wc-primary)]/45 bg-[var(--wc-primary)]/10"
                        : "border-[var(--wc-border,rgba(15,23,42,0.08))] bg-[var(--wc-shell,#ffffff)] hover:border-[var(--wc-primary)]/35 hover:bg-[var(--wc-assistant-bg,#f1f5f9)]"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--wc-shell-fg,#0f172a)]">
                        {item.category || "Conversation"}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] text-[var(--wc-muted,#64748b)]">
                          {formatRelative(item.startedAt)}
                        </span>
                        <span className="rounded-full bg-[var(--wc-primary)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--wc-primary)]">
                          Resume
                        </span>
                      </span>
                    </span>
                    <span className="line-clamp-2 text-[12px] text-[var(--wc-assistant-fg,#0f172a)] opacity-75">
                      {previewText(item)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
