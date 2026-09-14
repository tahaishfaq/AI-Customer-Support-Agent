-- Realtime Phase 1 foundation: durable outbox, scoped sessions/capabilities,
-- and versions for reconciliation. No existing domain rows are deleted.

CREATE TYPE "RealtimeVisibility" AS ENUM ('OWNER', 'PUBLIC', 'BOTH');

ALTER TABLE "User"
  ADD COLUMN "realtimeSessionVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Workspace"
  ADD COLUMN "inboxVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Conversation"
  ADD COLUMN "realtimeVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Subscription"
  ADD COLUMN "realtimeVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RealtimeSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenId" TEXT NOT NULL,
  "deviceLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  CONSTRAINT "RealtimeSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RealtimeOutboxEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "visibility" "RealtimeVisibility" NOT NULL,
  "userId" TEXT,
  "workspaceId" TEXT,
  "agentId" TEXT,
  "conversationId" TEXT,
  "aggregateType" TEXT NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "deadLetteredAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "leaseOwner" TEXT,
  "leaseUntil" TIMESTAMP(3),
  CONSTRAINT "RealtimeOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicConversationAccess" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "customerSubjectHash" TEXT,
  "originHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "PublicConversationAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RealtimeSession_tokenId_key" ON "RealtimeSession"("tokenId");
CREATE UNIQUE INDEX "RealtimeOutboxEvent_eventId_key" ON "RealtimeOutboxEvent"("eventId");
CREATE UNIQUE INDEX "PublicConversationAccess_tokenHash_key" ON "PublicConversationAccess"("tokenHash");

CREATE INDEX "RealtimeSession_userId_revokedAt_idx" ON "RealtimeSession"("userId", "revokedAt");
CREATE INDEX "RealtimeSession_expiresAt_idx" ON "RealtimeSession"("expiresAt");
CREATE INDEX "RealtimeOutboxEvent_publishedAt_availableAt_idx" ON "RealtimeOutboxEvent"("publishedAt", "availableAt");
CREATE INDEX "RealtimeOutboxEvent_leaseUntil_idx" ON "RealtimeOutboxEvent"("leaseUntil");
CREATE INDEX "RealtimeOutboxEvent_conversationId_aggregateVersion_idx" ON "RealtimeOutboxEvent"("conversationId", "aggregateVersion");
CREATE INDEX "RealtimeOutboxEvent_workspaceId_createdAt_idx" ON "RealtimeOutboxEvent"("workspaceId", "createdAt");
CREATE INDEX "PublicConversationAccess_conversationId_revokedAt_idx" ON "PublicConversationAccess"("conversationId", "revokedAt");
CREATE INDEX "PublicConversationAccess_expiresAt_idx" ON "PublicConversationAccess"("expiresAt");

ALTER TABLE "RealtimeSession"
  ADD CONSTRAINT "RealtimeSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicConversationAccess"
  ADD CONSTRAINT "PublicConversationAccess_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
