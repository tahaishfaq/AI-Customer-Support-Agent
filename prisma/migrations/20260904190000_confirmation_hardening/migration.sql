-- Stage 5.1 — confirmation hardening: one PENDING row per capability+argsHash.

CREATE UNIQUE INDEX IF NOT EXISTS "ActionConfirmation_pending_http_uniq"
  ON "ActionConfirmation" ("conversationId", "actionId", "argsHash")
  WHERE status = 'PENDING' AND "actionId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ActionConfirmation_pending_mcp_uniq"
  ON "ActionConfirmation" ("conversationId", "mcpToolId", "argsHash")
  WHERE status = 'PENDING' AND "mcpToolId" IS NOT NULL;

-- Lookup helpers for claim/approve races.
CREATE INDEX IF NOT EXISTS "ActionConfirmation_claim_lookup_idx"
  ON "ActionConfirmation" ("conversationId", "argsHash", status);
