"use client";

import { AgentStudioFrame } from "@/components/agents/AgentStudioFrame";
import { AgentSharePanel } from "@/components/studio/AgentSharePanel";
import { useAgentStudio } from "@/hooks/use-agent-studio";

export default function AgentSharePage() {
  const studio = useAgentStudio();

  return (
    <AgentStudioFrame
      agent={studio.agent}
      loading={studio.loading}
      error={studio.error}
      deleteOpen={studio.deleteOpen}
      onDeleteOpenChange={studio.setDeleteOpen}
    >
      {(agent) => <AgentSharePanel agent={agent} />}
    </AgentStudioFrame>
  );
}
