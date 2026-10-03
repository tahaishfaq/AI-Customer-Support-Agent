-- Level 3 · L1–L4 (additive). Neon pgvector optional: feature stays off if extension missing.
-- Safe for live DB: new tables/columns only; no renames or drops.

CREATE EXTENSION IF NOT EXISTS vector;

-- L1 Semantic RAG chunks (embeddings via raw SQL; Prisma maps embedding as Unsupported).
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "embedding" vector(1536),
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_agentId_idx" ON "KnowledgeChunk"("agentId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_documentId_contentHash_idx" ON "KnowledgeChunk"("documentId", "contentHash");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_agentId_model_idx" ON "KnowledgeChunk"("agentId", "model");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeChunk_documentId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeChunk"
      ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- HNSW may fail on empty/unsupported setups; ignore if unavailable.
DO $$
BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
      ON "KnowledgeChunk"
      USING hnsw ("embedding" vector_cosine_ops);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'KnowledgeChunk HNSW index skipped: %', SQLERRM;
  END;
END $$;

-- L2 Auto-QA
CREATE TABLE IF NOT EXISTS "ConversationQa" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "cxScore" INTEGER,
  "grounded" JSONB,
  "resolved" BOOLEAN,
  "tone" TEXT,
  "sentiment" TEXT,
  "issues" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OK',
  "model" TEXT,
  "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationQa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationQa_conversationId_version_key"
  ON "ConversationQa"("conversationId", "version");
CREATE INDEX IF NOT EXISTS "ConversationQa_conversationId_idx" ON "ConversationQa"("conversationId");
CREATE INDEX IF NOT EXISTS "ConversationQa_cxScore_idx" ON "ConversationQa"("cxScore");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConversationQa_conversationId_fkey'
  ) THEN
    ALTER TABLE "ConversationQa"
      ADD CONSTRAINT "ConversationQa_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- L3 Knowledge-gap suggestions
CREATE TABLE IF NOT EXISTS "KnowledgeSuggestion" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "clusterKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "draftAnswer" TEXT NOT NULL,
  "questionSamples" JSONB,
  "sourceConversationIds" JSONB,
  "conflictWithDocumentId" TEXT,
  "embeddingModel" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "publishedDocumentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeSuggestion_agentId_status_idx"
  ON "KnowledgeSuggestion"("agentId", "status");
CREATE INDEX IF NOT EXISTS "KnowledgeSuggestion_workspaceId_idx"
  ON "KnowledgeSuggestion"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeSuggestion_agentId_clusterKey_key"
  ON "KnowledgeSuggestion"("agentId", "clusterKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeSuggestion_agentId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeSuggestion"
      ADD CONSTRAINT "KnowledgeSuggestion_agentId_fkey"
      FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- L1/L4 agent + conversation columns
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "semanticRagEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "procedures" JSONB;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "qaSettings" JSONB;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "procedureState" JSONB;
