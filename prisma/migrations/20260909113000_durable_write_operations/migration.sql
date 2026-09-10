CREATE TYPE "DurableWriteStatus" AS ENUM ('PREPARED', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED', 'OUTCOME_UNKNOWN');

CREATE TYPE "ReconciliationStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'IN_PROGRESS', 'RESOLVED', 'HANDOFF');

CREATE TABLE "DurableWriteOperation" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "customerSubject" TEXT,
    "principalScope" TEXT NOT NULL,
    "actionId" TEXT,
    "actionRevisionId" TEXT,
    "approvalId" TEXT,
    "logicalOperationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "upstreamIdempotencyKey" TEXT,
    "status" "DurableWriteStatus" NOT NULL DEFAULT 'PREPARED',
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "outcomeCode" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "DurableWriteOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DurableWriteOperation_workspaceId_principalScope_logicalOperationId_key" ON "DurableWriteOperation"("workspaceId", "principalScope", "logicalOperationId");
CREATE UNIQUE INDEX "DurableWriteOperation_workspaceId_principalScope_idempotencyKey_key" ON "DurableWriteOperation"("workspaceId", "principalScope", "idempotencyKey");
CREATE INDEX "DurableWriteOperation_agentId_createdAt_idx" ON "DurableWriteOperation"("agentId", "createdAt");
CREATE INDEX "DurableWriteOperation_conversationId_createdAt_idx" ON "DurableWriteOperation"("conversationId", "createdAt");
CREATE INDEX "DurableWriteOperation_status_leaseUntil_idx" ON "DurableWriteOperation"("status", "leaseUntil");
CREATE INDEX "DurableWriteOperation_reconciliationStatus_updatedAt_idx" ON "DurableWriteOperation"("reconciliationStatus", "updatedAt");

ALTER TABLE "DurableWriteOperation" ADD CONSTRAINT "DurableWriteOperation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
