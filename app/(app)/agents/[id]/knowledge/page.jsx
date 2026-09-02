"use client";

import { AgentStudioFrame } from "@/components/agents/AgentStudioFrame";
import { KnowledgeList } from "@/components/knowledge/KnowledgeList";
import { useAgentStudio } from "@/hooks/use-agent-studio";

export default function AgentKnowledgePage() {
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
        <KnowledgeList
          agentId={agent.id}
          siteCrawledAt={agent.siteCrawledAt}
          siteKnowledgeOrigin={agent.siteKnowledgeOrigin}
          crawlRecrawlHours={agent.crawlRecrawlHours ?? 0}
          webSearchEnabled={agent.webSearchEnabled === true}
          onCrawlScheduleChange={(hours) =>
            studio.setAgent((prev) =>
              prev ? { ...prev, crawlRecrawlHours: hours } : prev
            )
          }
          onWebSearchChange={(enabled) =>
            studio.setAgent((prev) =>
              prev ? { ...prev, webSearchEnabled: enabled } : prev
            )
          }
        />
      )}
    </AgentStudioFrame>
  );
}
