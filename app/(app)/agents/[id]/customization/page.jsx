"use client";

import { AgentStudioFrame } from "@/components/agents/AgentStudioFrame";
import { CustomizationStudio } from "@/components/customization/CustomizationStudio";
import { useAgentStudio } from "@/hooks/use-agent-studio";

export default function AgentCustomizationPage() {
  const studio = useAgentStudio();

  return (
    <AgentStudioFrame
      agent={studio.agent}
      loading={studio.loading}
      error={studio.error}
      deleteOpen={studio.deleteOpen}
      onDeleteOpenChange={studio.setDeleteOpen}
    >
      {(agent) => <CustomizationStudio agent={agent} />}
    </AgentStudioFrame>
  );
}
