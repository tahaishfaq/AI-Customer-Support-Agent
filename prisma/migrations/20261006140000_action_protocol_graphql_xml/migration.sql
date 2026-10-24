-- AIDE-GAP-003/004/005/006/011 — protocol adapters, HTTP methods, mapping, pagination

DO $$ BEGIN
  CREATE TYPE "ActionProtocol" AS ENUM ('REST_JSON', 'GRAPHQL', 'XML');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "ActionHttpMethod" ADD VALUE 'PUT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "ActionHttpMethod" ADD VALUE 'PATCH';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "ActionHttpMethod" ADD VALUE 'DELETE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AgentAction" ADD COLUMN IF NOT EXISTS "protocol" "ActionProtocol" NOT NULL DEFAULT 'REST_JSON';
ALTER TABLE "AgentAction" ADD COLUMN IF NOT EXISTS "graphqlOperation" TEXT;
ALTER TABLE "AgentAction" ADD COLUMN IF NOT EXISTS "graphqlOperationName" TEXT;
ALTER TABLE "AgentAction" ADD COLUMN IF NOT EXISTS "resultInstructions" TEXT;
ALTER TABLE "AgentAction" ADD COLUMN IF NOT EXISTS "paginationJson" JSONB;

ALTER TABLE "ActionRevision" ADD COLUMN IF NOT EXISTS "protocol" "ActionProtocol" NOT NULL DEFAULT 'REST_JSON';
ALTER TABLE "ActionRevision" ADD COLUMN IF NOT EXISTS "graphqlOperation" TEXT;
ALTER TABLE "ActionRevision" ADD COLUMN IF NOT EXISTS "graphqlOperationName" TEXT;
ALTER TABLE "ActionRevision" ADD COLUMN IF NOT EXISTS "resultInstructions" TEXT;
ALTER TABLE "ActionRevision" ADD COLUMN IF NOT EXISTS "paginationJson" JSONB;
