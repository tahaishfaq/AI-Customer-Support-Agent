CREATE TYPE "TaskRevisionState" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'RETIRED');
CREATE TYPE "TaskRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PAUSED', 'ESCALATED');

CREATE TABLE "AgentTask" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "currentDraftRevisionId" TEXT,
  "publishedRevisionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskRevision" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "state" "TaskRevisionState" NOT NULL DEFAULT 'DRAFT',
  "configurationHash" TEXT NOT NULL,
  "supportedIntents" JSONB NOT NULL,
  "requiredIdentity" "ActionIdentityMode" NOT NULL DEFAULT 'NONE',
  "allowedActionRevisions" JSONB NOT NULL,
  "steps" JSONB NOT NULL,
  "dependencies" JSONB,
  "outputMappings" JSONB,
  "confirmationCheckpoints" JSONB,
  "failurePolicy" JSONB,
  "budgets" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskRun" (
  "id" TEXT NOT NULL,
  "taskRevisionId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "conversationId" TEXT,
  "customerSubject" TEXT,
  "status" "TaskRunStatus" NOT NULL DEFAULT 'RUNNING',
  "requestId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskStepRun" (
  "id" TEXT NOT NULL,
  "taskRunId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "actionRevisionId" TEXT,
  "actionName" TEXT,
  "status" TEXT NOT NULL,
  "resultCode" TEXT,
  "httpStatus" INTEGER,
  "errorCode" TEXT,
  "resultJson" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "TaskStepRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentTask_agentId_name_key" ON "AgentTask"("agentId", "name");
CREATE INDEX "AgentTask_agentId_enabled_idx" ON "AgentTask"("agentId", "enabled");
CREATE UNIQUE INDEX "TaskRevision_taskId_revision_key" ON "TaskRevision"("taskId", "revision");
CREATE INDEX "TaskRevision_taskId_state_idx" ON "TaskRevision"("taskId", "state");
CREATE INDEX "TaskRun_agentId_createdAt_idx" ON "TaskRun"("agentId", "createdAt");
CREATE INDEX "TaskRun_conversationId_idx" ON "TaskRun"("conversationId");
CREATE INDEX "TaskStepRun_taskRunId_idx" ON "TaskStepRun"("taskRunId");
CREATE INDEX "TaskStepRun_actionRevisionId_idx" ON "TaskStepRun"("actionRevisionId");

ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskRevision" ADD CONSTRAINT "TaskRevision_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_taskRevisionId_fkey"
  FOREIGN KEY ("taskRevisionId") REFERENCES "TaskRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskStepRun" ADD CONSTRAINT "TaskStepRun_taskRunId_fkey"
  FOREIGN KEY ("taskRunId") REFERENCES "TaskRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskStepRun" ADD CONSTRAINT "TaskStepRun_actionRevisionId_fkey"
  FOREIGN KEY ("actionRevisionId") REFERENCES "ActionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
