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
    <div className="flex min-h-0 flex-1 flex-col bg-[#f8fafc]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] bg-white px-3 py-2.5">
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-text)]">
            Chat history
          </p>
          <p className="text-[11px] text-[var(--color-muted)]">
            Open a past chat to resume
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={onNewChat}
        >
          <Plus className="size-3.5" />
          New
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-14 bg-[var(--color-border)]" />
            <Skeleton className="h-14 bg-[var(--color-border)]" />
            <Skeleton className="h-14 bg-[var(--color-border)]" />
          </div>
        ) : error ? (
          <p className="px-4 py-8 text-center text-[12px] text-[var(--color-danger)]">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <MessageSquare className="size-4" />
            </span>
            <p className="mt-3 text-[13px] font-medium text-[var(--color-text)]">
              No chats yet
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">
              Start a new conversation to see it here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors",
                      active
                        ? "bg-[var(--color-primary)]/8"
                        : "hover:bg-white"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--color-text)]">
                        {item.category || "Conversation"}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] text-[var(--color-muted)]">
                          {formatRelative(item.startedAt)}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--color-primary)]">
                          Resume
                        </span>
                      </span>
                    </span>
                    <span className="line-clamp-2 text-[12px] text-[var(--color-text-secondary)]">
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
