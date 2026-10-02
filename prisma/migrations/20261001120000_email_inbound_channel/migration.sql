-- Level 2 · P8 — email channel source + inbound idempotency.
ALTER TYPE "ConversationSource" ADD VALUE IF NOT EXISTS 'EMAIL';

ALTER TABLE "Agent"
ADD COLUMN IF NOT EXISTS "emailChannel" JSONB,
ADD COLUMN IF NOT EXISTS "emailChannelAddress" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Agent_emailChannelAddress_key"
ON "Agent"("emailChannelAddress");

CREATE TABLE IF NOT EXISTS "InboundEmail" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "fromAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InboundEmail_messageId_key"
ON "InboundEmail"("messageId");

CREATE INDEX IF NOT EXISTS "InboundEmail_agentId_createdAt_idx"
ON "InboundEmail"("agentId", "createdAt");

CREATE INDEX IF NOT EXISTS "InboundEmail_conversationId_idx"
ON "InboundEmail"("conversationId");

ALTER TABLE "InboundEmail"
ADD CONSTRAINT "InboundEmail_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
