ALTER TABLE "AgentAction"
  ADD COLUMN "requestContentType" TEXT DEFAULT 'application/json',
  ADD COLUMN "requestBodyTemplate" JSONB,
  ADD COLUMN "parameterBindings" JSONB;
