"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getConversation } from "@/lib/api/conversations";
import { ConversationsShell } from "@/components/conversations/ConversationsShell";
import { ConversationThread } from "@/components/conversations/ConversationThread";
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <ConversationsShell selectedId={id}>
      {loading ? (
        <div className="flex h-full">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
              <Skeleton className="h-8 w-48 bg-[var(--color-border)]" />
            </div>
            <div className="flex-1 space-y-3 p-6">
              <Skeleton className="h-16 w-2/3 rounded-2xl bg-[var(--color-border)]" />
              <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl bg-[var(--color-border)]" />
            </div>
          </div>
        </div>
      ) : error || !conversation ? (
        <div className="flex h-full flex-col items-center justify-center px-6">
          <p className="text-sm text-[var(--color-danger)]">
            {error || "Conversation not found"}
          </p>
          <Link
            href="/conversations"
            className="mt-3 text-sm font-medium text-[var(--color-primary)] underline"
          >
            Back to inbox
          </Link>
        </div>
      ) : (
        <ConversationThread conversation={conversation} />
      )}
    </ConversationsShell>
  );
}
