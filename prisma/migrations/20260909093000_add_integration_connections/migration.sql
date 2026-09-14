ALTER TABLE "AgentAction" ADD COLUMN "connectionId" TEXT;

CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'production',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "currentRevisionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationConnectionRevision" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "baseOrigin" TEXT NOT NULL,
  "allowedDestinations" JSONB,
  "credentialId" TEXT,
  "headerPolicy" JSONB,
  "healthVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationConnectionRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationConnection_workspaceId_name_key" ON "IntegrationConnection"("workspaceId", "name");
CREATE INDEX "IntegrationConnection_workspaceId_enabled_idx" ON "IntegrationConnection"("workspaceId", "enabled");
CREATE UNIQUE INDEX "IntegrationConnectionRevision_connectionId_revision_key" ON "IntegrationConnectionRevision"("connectionId", "revision");
CREATE INDEX "IntegrationConnectionRevision_connectionId_createdAt_idx" ON "IntegrationConnectionRevision"("connectionId", "createdAt");
CREATE INDEX "IntegrationConnectionRevision_credentialId_idx" ON "IntegrationConnectionRevision"("credentialId");
CREATE INDEX "AgentAction_connectionId_idx" ON "AgentAction"("connectionId");

ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnectionRevision" ADD CONSTRAINT "IntegrationConnectionRevision_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnectionRevision" ADD CONSTRAINT "IntegrationConnectionRevision_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "ActionCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
