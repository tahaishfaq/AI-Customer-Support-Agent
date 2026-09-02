-- W3-5: speed analytics range scans (agentId + startedAt)
CREATE INDEX "Conversation_agentId_startedAt_idx" ON "Conversation"("agentId", "startedAt");
