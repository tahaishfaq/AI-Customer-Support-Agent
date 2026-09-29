-- Switch from whole-agent KB share to per-document live shares.
DROP TABLE IF EXISTS "AgentKnowledgeShare";

CREATE TABLE IF NOT EXISTS "KnowledgeDocumentShare" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "consumerAgentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocumentShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDocumentShare_documentId_consumerAgentId_key"
ON "KnowledgeDocumentShare"("documentId", "consumerAgentId");

CREATE INDEX IF NOT EXISTS "KnowledgeDocumentShare_consumerAgentId_idx"
ON "KnowledgeDocumentShare"("consumerAgentId");

ALTER TABLE "KnowledgeDocumentShare"
ADD CONSTRAINT "KnowledgeDocumentShare_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeDocumentShare"
ADD CONSTRAINT "KnowledgeDocumentShare_consumerAgentId_fkey"
FOREIGN KEY ("consumerAgentId") REFERENCES "Agent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
