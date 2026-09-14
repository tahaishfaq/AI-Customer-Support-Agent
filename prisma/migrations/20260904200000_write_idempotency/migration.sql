-- Stage 5.6 — WRITE idempotency records
CREATE TABLE IF NOT EXISTS "WriteIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "actionId" TEXT,
    "mcpToolId" TEXT,
    "argsHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "bodyText" TEXT,
    "resultForModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WriteIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WriteIdempotencyRecord_idempotencyKey_key" ON "WriteIdempotencyRecord"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "WriteIdempotencyRecord_expiresAt_idx" ON "WriteIdempotencyRecord"("expiresAt");
CREATE INDEX IF NOT EXISTS "WriteIdempotencyRecord_agentId_createdAt_idx" ON "WriteIdempotencyRecord"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "WriteIdempotencyRecord_conversationId_idx" ON "WriteIdempotencyRecord"("conversationId");
