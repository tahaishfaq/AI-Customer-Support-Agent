-- F11 Phase A — Agent actions + tool audit
CREATE TYPE "ActionHttpMethod" AS ENUM ('GET', 'POST');
CREATE TYPE "ToolRunStatus" AS ENUM (
  'OK',
  'ERROR',
  'TIMEOUT',
  'SSRF_BLOCKED',
  'SCHEMA_INVALID',
  'DISABLED',
  'UNKNOWN_TOOL',
  'MAX_STEPS'
);

CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "method" "ActionHttpMethod" NOT NULL DEFAULT 'GET',
    "urlTemplate" TEXT NOT NULL,
    "headersJson" JSONB,
    "inputSchemaJson" JSONB,
    "outputSchemaJson" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timeoutMs" INTEGER NOT NULL DEFAULT 8000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ToolRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "actionId" TEXT,
    "conversationId" TEXT,
    "status" "ToolRunStatus" NOT NULL,
    "durationMs" INTEGER,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentAction_agentId_name_key" ON "AgentAction"("agentId", "name");
CREATE INDEX "AgentAction_agentId_idx" ON "AgentAction"("agentId");
CREATE INDEX "AgentAction_agentId_enabled_idx" ON "AgentAction"("agentId", "enabled");
CREATE INDEX "ToolRun_agentId_createdAt_idx" ON "ToolRun"("agentId", "createdAt");
CREATE INDEX "ToolRun_actionId_idx" ON "ToolRun"("actionId");
CREATE INDEX "ToolRun_conversationId_idx" ON "ToolRun"("conversationId");

ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolRun" ADD CONSTRAINT "ToolRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolRun" ADD CONSTRAINT "ToolRun_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "AgentAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
