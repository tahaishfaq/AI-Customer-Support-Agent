"use client";

import { AgentStudioFrame } from "@/components/agents/AgentStudioFrame";
import { AnalyticsBoard } from "@/components/analytics/AnalyticsBoard";
import { useAgentStudio } from "@/hooks/use-agent-studio";

export default function AgentAnalyticsPage() {
  const studio = useAgentStudio();

  return (
    <AgentStudioFrame
      agent={studio.agent}
      loading={studio.loading}
      error={studio.error}
      deleteOpen={studio.deleteOpen}
      onDeleteOpenChange={studio.setDeleteOpen}
    >
      {(agent) => <AnalyticsBoard agentId={agent.id} />}
    </AgentStudioFrame>
  );
}
