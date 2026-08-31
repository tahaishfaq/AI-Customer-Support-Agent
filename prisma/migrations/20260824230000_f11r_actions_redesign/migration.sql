-- F11 redesign R1–R5 schema foundation (credentials, identity, risk, audit)

CREATE TYPE "ActionCredentialType" AS ENUM ('BEARER', 'API_KEY_HEADER');
CREATE TYPE "ActionRiskLevel" AS ENUM ('READ', 'WRITE', 'DESTRUCTIVE');
CREATE TYPE "ActionConfirmationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

CREATE TABLE "ActionCredential" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ActionCredentialType" NOT NULL DEFAULT 'BEARER',
    "headerName" TEXT,
    "ciphertext" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "revokedAt" TIMESTAMP(3),
    "lastRotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionCredential_workspaceId_name_key" ON "ActionCredential"("workspaceId", "name");
CREATE INDEX "ActionCredential_workspaceId_idx" ON "ActionCredential"("workspaceId");

ALTER TABLE "ActionCredential" ADD CONSTRAINT "ActionCredential_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentAction"
  ADD COLUMN "frozenHost" TEXT,
  ADD COLUMN "credentialId" TEXT,
  ADD COLUMN "riskLevel" "ActionRiskLevel" NOT NULL DEFAULT 'READ',
  ADD COLUMN "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresIdentity" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "idempotent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "AgentAction_credentialId_idx" ON "AgentAction"("credentialId");

ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "ActionCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill frozenHost from urlTemplate host where possible
UPDATE "AgentAction"
SET "frozenHost" = lower(substring("urlTemplate" from 'https?://([^/?#:]+)'))
WHERE "frozenHost" IS NULL AND "urlTemplate" ~ '^https?://';

CREATE TABLE "ActionConfirmation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "argsHash" TEXT NOT NULL,
    "status" "ActionConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionConfirmation_conversationId_status_idx" ON "ActionConfirmation"("conversationId", "status");
CREATE INDEX "ActionConfirmation_actionId_idx" ON "ActionConfirmation"("actionId");
CREATE INDEX "ActionConfirmation_expiresAt_idx" ON "ActionConfirmation"("expiresAt");

ALTER TABLE "ActionConfirmation" ADD CONSTRAINT "ActionConfirmation_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionConfirmation" ADD CONSTRAINT "ActionConfirmation_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "AgentAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation"
  ADD COLUMN "customerSubject" TEXT,
  ADD COLUMN "identityIss" TEXT,
  ADD COLUMN "identityExpiresAt" TIMESTAMP(3);

CREATE INDEX "Conversation_customerSubject_idx" ON "Conversation"("customerSubject");

ALTER TABLE "ToolRun"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "customerSubject" TEXT,
  ADD COLUMN "actionVersion" INTEGER,
  ADD COLUMN "errorCategory" TEXT;

CREATE INDEX "ToolRun_workspaceId_createdAt_idx" ON "ToolRun"("workspaceId", "createdAt");
