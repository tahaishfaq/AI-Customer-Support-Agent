"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAdminConversation } from "@/lib/api/admin";
import { AdminConversationsInbox } from "@/components/admin/AdminConversationsInbox";
import { ConversationThread } from "@/components/conversations/ConversationThread";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminConversationThread() {
  const params = useParams();
  const conversationId = params?.conversationId;
  const userId = params?.id;
  const workspaceId = params?.workspaceId;
  const agentId = params?.agentId;
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const inboxHref = `/admin/users/${userId}/workspaces/${workspaceId}/agents/${agentId}/conversations`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!conversationId) return;
      setLoading(true);
      setError("");
      try {
        const data = await getAdminConversation(conversationId);
        if (!cancelled) setConversation(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load conversation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  return (
    <AdminConversationsInbox selectedId={conversationId}>
      {loading ? (
        <div className="flex h-full flex-col p-6">
          <Skeleton className="h-8 w-48 bg-[var(--color-border)]" />
          <Skeleton className="mt-6 h-16 w-2/3 bg-[var(--color-border)]" />
        </div>
      ) : error || !conversation || conversation.agentId !== agentId ? (
        <div className="flex h-full flex-col items-center justify-center px-6">
          <p className="text-sm text-[var(--color-danger)]">
            {error || "Conversation not found for this agent"}
          </p>
          <Link
            href={inboxHref}
            className="mt-3 text-sm font-medium text-[var(--color-primary)] underline"
          >
            Back to inbox
          </Link>
        </div>
      ) : (
        <ConversationThread
          conversation={conversation}
          readOnly
          inboxHref={inboxHref}
        />
      )}
    </AdminConversationsInbox>
  );
}
