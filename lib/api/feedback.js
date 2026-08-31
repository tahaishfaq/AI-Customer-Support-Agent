import { apiFetch } from "@/lib/api-client";

export async function listAgentFeedback(agentId, { limit } = {}) {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  const qs = params.toString();
  return apiFetch(`/api/agents/${agentId}/feedback${qs ? `?${qs}` : ""}`);
}
