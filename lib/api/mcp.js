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

/** Ephemeral tools/list before Save (no server row). */
export async function probeDraftAgentMcpServer(agentId, body) {
  return apiFetch(`/api/agents/${agentId}/mcp-servers/probe-draft`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Platform GitHub OAuth App status (no secrets). */
export async function getGithubMcpOauthStatus(agentId) {
  return apiFetch(`/api/agents/${agentId}/mcp-servers/github-oauth`);
}

/** Start GitHub MCP OAuth — returns authorizeUrl. */
export async function startGithubMcpOauth(agentId, body = {}) {
  return apiFetch(`/api/agents/${agentId}/mcp-servers/github-oauth`, {
    method: "POST",
    body: JSON.stringify(body),
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
