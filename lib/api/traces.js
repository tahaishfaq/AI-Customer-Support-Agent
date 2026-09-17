import { apiFetch } from "@/lib/api-client";

export async function listAgentTraces(agentId, { conversationId, take } = {}) {
  const params = new URLSearchParams();
  if (conversationId) params.set("conversationId", conversationId);
  if (take) params.set("take", String(take));
  const q = params.toString() ? `?${params}` : "";
  const data = await apiFetch(`/api/agents/${agentId}/traces${q}`);
  return data.turns || [];
}

export async function getAgentTrace(agentId, turnRunId) {
  const data = await apiFetch(`/api/agents/${agentId}/traces/${turnRunId}`);
  return data.trace || null;
}
