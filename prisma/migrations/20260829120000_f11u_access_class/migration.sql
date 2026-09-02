-- F11-U Sprint C: persist accessClass on AgentAction
CREATE TYPE "ActionAccessClass" AS ENUM (
  'PUBLIC_READ',
  'GUEST_LOOKUP',
  'ACCOUNT_READ',
  'ACCOUNT_WRITE',
  'DESTRUCTIVE'
);

ALTER TABLE "AgentAction"
  ADD COLUMN IF NOT EXISTS "accessClass" "ActionAccessClass" NOT NULL DEFAULT 'PUBLIC_READ';

-- Backfill from identityMode + riskLevel (+ name heuristics for guest lookup)
UPDATE "AgentAction"
SET "accessClass" = CASE
  WHEN "identityMode" = 'END_USER_TOKEN' AND "riskLevel" = 'DESTRUCTIVE' THEN 'DESTRUCTIVE'::"ActionAccessClass"
  WHEN "identityMode" = 'END_USER_TOKEN' AND "riskLevel" = 'WRITE' THEN 'ACCOUNT_WRITE'::"ActionAccessClass"
  WHEN "identityMode" = 'END_USER_TOKEN' OR "requiresIdentity" = true THEN 'ACCOUNT_READ'::"ActionAccessClass"
  WHEN "name" ~* '(track|lookup|guest|pnr)' THEN 'GUEST_LOOKUP'::"ActionAccessClass"
  ELSE 'PUBLIC_READ'::"ActionAccessClass"
END;
