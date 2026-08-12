import { apiFetch } from "@/lib/api-client";

export async function listAgents() {
  const data = await apiFetch("/api/agents");
  return data.agents || [];
}

export async function getAgent(id) {
  return apiFetch(`/api/agents/${id}`);
}

export async function createAgent(payload) {
  return apiFetch("/api/agents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAgent(id, payload) {
  return apiFetch(`/api/agents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAgent(id) {
  return apiFetch(`/api/agents/${id}`, {
    method: "DELETE",
  });
}
