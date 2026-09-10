import { apiFetch } from "@/lib/api-client";

export async function listAgentConnections(agentId) {
  const data = await apiFetch(`/api/agents/${agentId}/connections`);
  return data.connections || [];
}

export async function createAgentConnection(agentId, body) {
  return apiFetch(`/api/agents/${agentId}/connections`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
