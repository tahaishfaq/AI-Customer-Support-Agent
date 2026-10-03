import { apiFetch } from "@/lib/api-client";

export async function listKnowledgeSuggestions(agentId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/api/agents/${agentId}/knowledge-suggestions${qs}`);
}

export async function refreshKnowledgeSuggestions(agentId) {
  return apiFetch(`/api/agents/${agentId}/knowledge-suggestions`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function reviewKnowledgeSuggestion(agentId, suggestionId, body) {
  return apiFetch(`/api/agents/${agentId}/knowledge-suggestions/${suggestionId}`, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}
