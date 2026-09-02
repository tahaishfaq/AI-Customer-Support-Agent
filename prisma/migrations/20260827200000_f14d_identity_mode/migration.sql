-- F14-D: scoped credential identity modes on AgentAction
DO $$ BEGIN
  CREATE TYPE "ActionIdentityMode" AS ENUM ('NONE', 'OWNER_KEY', 'END_USER_TOKEN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "AgentAction"
  ADD COLUMN IF NOT EXISTS "identityMode" "ActionIdentityMode" NOT NULL DEFAULT 'NONE';

UPDATE "AgentAction"
SET "identityMode" = 'END_USER_TOKEN'
WHERE "requiresIdentity" = true AND "identityMode" = 'NONE';
