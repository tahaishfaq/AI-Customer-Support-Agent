"use client";

import { AgentStudioFrame } from "@/components/agents/AgentStudioFrame";
import { AgentTestStudio } from "@/components/studio/AgentTestStudio";
import { useAgentStudio } from "@/hooks/use-agent-studio";

export default function AgentTestPage() {
  const studio = useAgentStudio();

  return (
    <AgentStudioFrame
      agent={studio.agent}
      loading={studio.loading}
      error={studio.error}
      deleteOpen={studio.deleteOpen}
      onDeleteOpenChange={studio.setDeleteOpen}
    >
      {(agent) => <AgentTestStudio agent={agent} />}
    </AgentStudioFrame>
  );
}
