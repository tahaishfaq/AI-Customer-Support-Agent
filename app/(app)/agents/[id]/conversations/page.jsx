"use client";

import { AgentStudioFrame } from "@/components/agents/AgentStudioFrame";
import { ConversationsShell } from "@/components/conversations/ConversationsShell";
import { ConversationEmptyState } from "@/components/conversations/ConversationThread";
import { useAgentStudio } from "@/hooks/use-agent-studio";

export default function AgentConversationsPage() {
  const studio = useAgentStudio();

  return (
    <AgentStudioFrame
      agent={studio.agent}
      loading={studio.loading}
      error={studio.error}
      deleteOpen={studio.deleteOpen}
      onDeleteOpenChange={studio.setDeleteOpen}
    >
      {(agent) => (
        <ConversationsShell agentId={agent.id}>
          <ConversationEmptyState />
        </ConversationsShell>
      )}
    </AgentStudioFrame>
  );
}
