"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getConversation } from "@/lib/api/conversations";
import { InboxShell } from "@/components/desk/InboxShell";
import { DeskThread } from "@/components/desk/DeskThread";
import { Skeleton } from "@/components/ui/skeleton";

export default function InboxThreadPage() {
  const params = useParams();
  const conversationId = params?.conversationId;
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getConversation(conversationId);
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
  }, [conversationId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
      <InboxShell selectedId={conversationId}>
        {loading ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
              <Skeleton className="h-8 w-48 bg-[var(--color-border)]" />
            </div>
            <div className="flex-1 space-y-3 p-6">
              <Skeleton className="h-16 w-2/3 rounded-2xl bg-[var(--color-border)]" />
              <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl bg-[var(--color-border)]" />
            </div>
          </div>
        ) : error || !conversation ? (
          <div className="flex h-full flex-col items-center justify-center px-6">
            <p className="text-sm text-[var(--color-danger)]">
              {error || "Conversation not found"}
            </p>
            <Link
              href="/inbox"
              className="mt-3 text-sm font-medium text-[var(--color-primary)] underline"
            >
              Back to human desk
            </Link>
          </div>
        ) : (
          <DeskThread
            conversation={conversation}
            onResolved={() => {
              setConversation((prev) =>
                prev
                  ? {
                      ...prev,
                      status: "OPEN",
                      waitingForHuman: false,
                      aiPaused: false,
                    }
                  : prev
              );
            }}
          />
        )}
      </InboxShell>
    </div>
  );
}
