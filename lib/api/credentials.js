import { apiFetch } from "@/lib/api-client";

export async function listAgentCredentials(agentId) {
  const data = await apiFetch(`/api/agents/${agentId}/credentials`);
  return data.credentials || [];
}

export async function createAgentCredential(agentId, body) {
  return apiFetch(`/api/agents/${agentId}/credentials`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function rotateAgentCredential(agentId, credentialId, secret) {
  return apiFetch(`/api/agents/${agentId}/credentials/${credentialId}`, {
    method: "POST",
    body: JSON.stringify({ secret }),
  });
}

export async function revokeAgentCredential(agentId, credentialId) {
  return apiFetch(`/api/agents/${agentId}/credentials/${credentialId}`, {
    method: "DELETE",
  });
}

export async function installActionPack(agentId, packId, { credentialId } = {}) {
  return apiFetch(`/api/agents/${agentId}/action-packs`, {
    method: "POST",
    body: JSON.stringify({ packId, credentialId }),
  });
}
