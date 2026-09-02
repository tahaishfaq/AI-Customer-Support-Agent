import { apiFetch } from "@/lib/api-client";

export async function listAgentMcpServers(agentId) {
  const data = await apiFetch(`/api/agents/${agentId}/mcp-servers`);
  return data.servers || [];
}

export async function createAgentMcpServer(agentId, body) {
  return apiFetch(`/api/agents/${agentId}/mcp-servers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAgentMcpServer(agentId, serverId, body) {
  return apiFetch(`/api/agents/${agentId}/mcp-servers/${serverId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteAgentMcpServer(agentId, serverId) {
  return apiFetch(`/api/agents/${agentId}/mcp-servers/${serverId}`, {
    method: "DELETE",
  });
}

export async function probeAgentMcpServer(agentId, serverId) {
  return apiFetch(`/api/agents/${agentId}/mcp-servers/${serverId}/probe`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function updateAgentMcpTool(agentId, serverId, toolId, body) {
  return apiFetch(
    `/api/agents/${agentId}/mcp-servers/${serverId}/tools/${toolId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}
