import { apiFetch } from "@/lib/api-client";

export async function listInbox({
  status = "WAITING_HUMAN",
  priority = "ALL",
  limit,
  offset,
} = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  const qs = params.toString();
  return apiFetch(`/api/inbox${qs ? `?${qs}` : ""}`);
}

export async function markInboxSeen() {
  return apiFetch("/api/inbox/seen", { method: "POST" });
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

export async function sendInternalNote(conversationId, message) {
  return apiFetch(`/api/conversations/${conversationId}/notes`, {
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

export async function claimConversation(conversationId, claim = true) {
  return apiFetch(`/api/conversations/${conversationId}/claim`, {
    method: "POST",
    body: JSON.stringify({ claim }),
  });
}

export async function setConversationPriority(conversationId, priority) {
  return apiFetch(`/api/conversations/${conversationId}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority }),
  });
}

export async function listCannedReplies() {
  return apiFetch("/api/desk/canned-replies");
}

export async function saveCannedReplies(replies) {
  return apiFetch("/api/desk/canned-replies", {
    method: "PUT",
    body: JSON.stringify({ replies }),
  });
}
