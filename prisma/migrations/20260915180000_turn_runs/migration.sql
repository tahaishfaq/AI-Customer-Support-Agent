CREATE TABLE "TurnRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientMessageId" TEXT,
    "requestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "ownershipVersion" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TurnRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TurnRun_conversationId_clientMessageId_key"
ON "TurnRun"("conversationId", "clientMessageId");
CREATE INDEX "TurnRun_status_lastHeartbeatAt_idx" ON "TurnRun"("status", "lastHeartbeatAt");
CREATE INDEX "TurnRun_agentId_createdAt_idx" ON "TurnRun"("agentId", "createdAt");
CREATE INDEX "TurnRun_conversationId_createdAt_idx" ON "TurnRun"("conversationId", "createdAt");
ALTER TABLE "TurnRun" ADD CONSTRAINT "TurnRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TurnRun" ADD CONSTRAINT "TurnRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
