"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { listAdminConversations } from "@/lib/api/admin";
import { ConversationsShell } from "@/components/conversations/ConversationsShell";
import { ConversationEmptyState } from "@/components/conversations/ConversationThread";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAdminAgent } from "@/lib/api/admin";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminConversationsInbox({ selectedId, children }) {
  const params = useParams();
  const userId = params?.id;
  const workspaceId = params?.workspaceId;
  const agentId = params?.agentId;
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const inboxBase = `/admin/users/${userId}/workspaces/${workspaceId}/agents/${agentId}/conversations`;

  const listFn = useCallback(
    (opts) => listAdminConversations(agentId, opts),
    [agentId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!agentId) return;
      setLoading(true);
      try {
        const data = await getAdminAgent(agentId);
        if (!cancelled) setAgent(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load agent");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (loading) {
    return (
      <main className="aide-page">
        <Skeleton className="h-10 w-56 bg-muted" />
        <Skeleton className="mt-6 h-96 w-full bg-muted" />
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="aide-page">
        <p className="text-sm text-destructive">{error || "Not found"}</p>
      </main>
    );
  }

  return (
    <main className="aide-page">
      <p className="mb-3 text-[12px] text-muted-foreground">
        <Link href={`/admin/users/${userId}`} className="hover:underline">
          {agent.user.name}
        </Link>
        {" / "}
        <Link
          href={`/admin/users/${userId}/workspaces/${workspaceId}`}
          className="hover:underline"
        >
          {agent.workspace.name}
        </Link>
        {" / "}
        <Link
          href={`/admin/users/${userId}/workspaces/${workspaceId}/agents/${agentId}`}
          className="hover:underline"
        >
          {agent.name}
        </Link>
        {" / "}
        <span>Conversations</span>
      </p>
      <PageHeader
        title="Conversations"
        description={`Read-only inbox for ${agent.name}`}
      />
      <div className="mt-5">
        <ConversationsShell
          agentId={agentId}
          selectedId={selectedId}
          inboxBase={inboxBase}
          listFn={listFn}
          showNewChat={false}
          emptyHint="No conversations for this agent yet."
        >
          {children || <ConversationEmptyState />}
        </ConversationsShell>
      </div>
    </main>
  );
}
