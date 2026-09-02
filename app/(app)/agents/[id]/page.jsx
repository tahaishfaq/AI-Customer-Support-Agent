"use client";

import { useEffect, useState } from "react";
import { AgentStudioFrame } from "@/components/agents/AgentStudioFrame";
import { AgentOverview } from "@/components/agents/AgentOverview";
import { listAgentActions } from "@/lib/api/actions";
import { getOverview } from "@/lib/api/analytics";
import { listConversations } from "@/lib/api/conversations";
import { listAgentFeedback } from "@/lib/api/feedback";
import { listKnowledge } from "@/lib/api/knowledge";
import { useAgentStudio } from "@/hooks/use-agent-studio";

export default function AgentDetailPage() {
  const studio = useAgentStudio();
  const [overview, setOverview] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [actions, setActions] = useState([]);

  useEffect(() => {
    if (!studio.id) return;
    let cancelled = false;

    async function load() {
      try {
        const [overviewData, convoData, knowledge, feedbackData, actionData] =
          await Promise.all([
            getOverview({ agentId: studio.id }),
            listConversations({ agentId: studio.id, limit: 8, offset: 0 }),
            listKnowledge(studio.id),
            listAgentFeedback(studio.id, { limit: 8 }).catch(() => null),
            listAgentActions(studio.id).catch(() => []),
          ]);
        if (cancelled) return;
        setOverview(overviewData);
        setConversations(convoData.conversations || []);
        setKnowledgeCount(knowledge.documents?.length || 0);
        setFeedback(feedbackData);
        setActions(actionData || []);
      } catch {
        if (!cancelled) {
          setOverview(null);
          setConversations([]);
          setKnowledgeCount(0);
          setFeedback(null);
          setActions([]);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [studio.id]);

  return (
    <AgentStudioFrame
      agent={studio.agent}
      loading={studio.loading}
      error={studio.error}
      deleteOpen={studio.deleteOpen}
      onDeleteOpenChange={studio.setDeleteOpen}
    >
      {(agent) => (
        <AgentOverview
          agent={agent}
          overview={overview}
          knowledgeCount={knowledgeCount}
          conversations={conversations}
          feedback={feedback}
          actions={actions}
        />
      )}
    </AgentStudioFrame>
  );
}
