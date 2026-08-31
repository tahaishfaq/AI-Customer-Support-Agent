import { apiFetch } from "@/lib/api-client";

export async function listAgentActions(agentId) {
  const data = await apiFetch(`/api/agents/${agentId}/actions`);
  return data.actions || [];
}

export async function createAgentAction(agentId, body) {
  return apiFetch(`/api/agents/${agentId}/actions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAgentAction(agentId, actionId, body) {
  return apiFetch(`/api/agents/${agentId}/actions/${actionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteAgentAction(agentId, actionId) {
  return apiFetch(`/api/agents/${agentId}/actions/${actionId}`, {
    method: "DELETE",
  });
}

export async function testAgentAction(agentId, actionId, args = {}) {
  return apiFetch(`/api/agents/${agentId}/actions/${actionId}/test`, {
    method: "POST",
    body: JSON.stringify({ args }),
  });
}

export async function listAgentToolRuns(agentId, { take = 30 } = {}) {
  const q = take ? `?take=${encodeURIComponent(String(take))}` : "";
  const data = await apiFetch(`/api/agents/${agentId}/actions/runs${q}`);
  return data.runs || [];
}

export async function installAgentActionPack(agentId, packId, opts = {}) {
  const { installActionPack } = await import("@/lib/api/credentials");
  return installActionPack(agentId, packId, opts);
}
