-- Allow same-workspace agents to share a site origin; keep a non-unique lookup index.
DROP INDEX IF EXISTS "Agent_siteKnowledgeOrigin_key";

CREATE INDEX IF NOT EXISTS "Agent_siteKnowledgeOrigin_idx"
ON "Agent"("siteKnowledgeOrigin");

-- Opt-in: consumer agent may retrieve knowledge documents owned by a source agent.
CREATE TABLE IF NOT EXISTS "AgentKnowledgeShare" (
    "id" TEXT NOT NULL,
    "consumerAgentId" TEXT NOT NULL,
    "sourceAgentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKnowledgeShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentKnowledgeShare_consumerAgentId_sourceAgentId_key"
ON "AgentKnowledgeShare"("consumerAgentId", "sourceAgentId");

CREATE INDEX IF NOT EXISTS "AgentKnowledgeShare_sourceAgentId_idx"
ON "AgentKnowledgeShare"("sourceAgentId");

ALTER TABLE "AgentKnowledgeShare"
ADD CONSTRAINT "AgentKnowledgeShare_consumerAgentId_fkey"
FOREIGN KEY ("consumerAgentId") REFERENCES "Agent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentKnowledgeShare"
ADD CONSTRAINT "AgentKnowledgeShare_sourceAgentId_fkey"
FOREIGN KEY ("sourceAgentId") REFERENCES "Agent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
