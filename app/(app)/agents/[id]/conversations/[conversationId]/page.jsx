"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AgentStudioFrame } from "@/components/agents/AgentStudioFrame";
import { ConversationsShell } from "@/components/conversations/ConversationsShell";
import { ConversationThread } from "@/components/conversations/ConversationThread";
import { getConversation } from "@/lib/api/conversations";
import { useAgentStudio } from "@/hooks/use-agent-studio";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentConversationDetailPage() {
  const studio = useAgentStudio();
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
    <AgentStudioFrame
      agent={studio.agent}
      loading={studio.loading}
      error={studio.error}
      deleteOpen={studio.deleteOpen}
      onDeleteOpenChange={studio.setDeleteOpen}
    >
      {(agent) => {
        const belongsHere = conversation?.agentId === agent.id;
        const inboxHref = `/agents/${agent.id}/conversations`;

        return (
          <ConversationsShell agentId={agent.id} selectedId={conversationId}>
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
            ) : error || !conversation || !belongsHere ? (
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
              <ConversationThread conversation={conversation} />
            )}
          </ConversationsShell>
        );
      }}
    </AgentStudioFrame>
  );
}
