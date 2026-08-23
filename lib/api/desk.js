import { apiFetch } from "@/lib/api-client";

export async function listInbox({ status = "WAITING_HUMAN", limit, offset } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  const qs = params.toString();
  return apiFetch(`/api/inbox${qs ? `?${qs}` : ""}`);
}

export async function getInboxWaitingCount() {
  return apiFetch("/api/inbox/count");
}

export async function getDeskStats(days = 7) {
  return apiFetch(`/api/inbox/count?mode=stats&days=${days}`);
}

export async function triggerConversationHandoff(conversationId, { reason } = {}) {
  return apiFetch(`/api/conversations/${conversationId}/handoff`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function resolveConversation(conversationId, { resumeAi = true } = {}) {
  return apiFetch(`/api/conversations/${conversationId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resumeAi }),
  });
}

export async function sendHumanMessage(conversationId, message) {
  return apiFetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function signalHumanTyping(conversationId) {
  return apiFetch(`/api/conversations/${conversationId}/typing`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
