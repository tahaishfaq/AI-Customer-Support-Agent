CREATE TYPE "ActionRevisionState" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'RETIRED');

ALTER TABLE "AgentAction"
  ADD COLUMN "currentDraftRevisionId" TEXT,
  ADD COLUMN "publishedRevisionId" TEXT;

CREATE TABLE "ActionRevision" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "state" "ActionRevisionState" NOT NULL DEFAULT 'DRAFT',
  "configurationHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "method" "ActionHttpMethod" NOT NULL,
  "urlTemplate" TEXT NOT NULL,
  "frozenHost" TEXT,
  "connectionId" TEXT,
  "connectionRevisionId" TEXT,
  "headersJson" JSONB,
  "requestContentType" TEXT,
  "requestBodyTemplate" JSONB,
  "parameterBindings" JSONB,
  "inputSchemaJson" JSONB,
  "outputSchemaJson" JSONB,
  "responseProjectionJson" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "timeoutMs" INTEGER NOT NULL DEFAULT 8000,
  "credentialId" TEXT,
  "riskLevel" "ActionRiskLevel" NOT NULL DEFAULT 'READ',
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "requiresIdentity" BOOLEAN NOT NULL DEFAULT false,
  "identityMode" "ActionIdentityMode" NOT NULL DEFAULT 'NONE',
  "accessClass" "ActionAccessClass" NOT NULL DEFAULT 'PUBLIC_READ',
  "idempotent" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionRevision_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActionConfirmation" ADD COLUMN "actionRevisionId" TEXT;
ALTER TABLE "ToolRun" ADD COLUMN "actionRevisionId" TEXT;

CREATE UNIQUE INDEX "ActionRevision_actionId_revision_key" ON "ActionRevision"("actionId", "revision");
CREATE INDEX "ActionRevision_actionId_state_idx" ON "ActionRevision"("actionId", "state");
CREATE INDEX "ActionRevision_configurationHash_idx" ON "ActionRevision"("configurationHash");
CREATE INDEX "AgentAction_publishedRevisionId_idx" ON "AgentAction"("publishedRevisionId");
CREATE INDEX "ActionConfirmation_actionRevisionId_idx" ON "ActionConfirmation"("actionRevisionId");
CREATE INDEX "ToolRun_actionRevisionId_idx" ON "ToolRun"("actionRevisionId");

ALTER TABLE "ActionRevision" ADD CONSTRAINT "ActionRevision_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "AgentAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionConfirmation" ADD CONSTRAINT "ActionConfirmation_actionRevisionId_fkey"
  FOREIGN KEY ("actionRevisionId") REFERENCES "ActionRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolRun" ADD CONSTRAINT "ToolRun_actionRevisionId_fkey"
  FOREIGN KEY ("actionRevisionId") REFERENCES "ActionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
