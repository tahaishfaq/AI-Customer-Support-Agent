import { apiFetch } from "@/lib/api-client";

export async function listConversations({ agentId, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (agentId) params.set("agentId", agentId);
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  const qs = params.toString();
  return apiFetch(`/api/conversations${qs ? `?${qs}` : ""}`);
}

export async function getConversation(id) {
  return apiFetch(`/api/conversations/${id}`);
}
