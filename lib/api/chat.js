import { apiFetch } from "@/lib/api-client";

export async function sendChatMessage(agentId, { message, conversationId }) {
  const body = { message };
  if (conversationId) body.conversationId = conversationId;

  return apiFetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** F14-A — continue tool execution after the user approved in chat UI. */
export async function resumeChatAfterConfirmation(
  agentId,
  { conversationId, confirmationId }
) {
  return apiFetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify({
      conversationId,
      resumeAfterConfirmationId: confirmationId,
    }),
  });
}

/** F14-A — embed: resume after public confirmation approve. */
export async function resumePublicChatAfterConfirmation(
  publicKey,
  { conversationId, confirmationId, userSession }
) {
  const res = await fetch(`/api/public/agents/${publicKey}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId,
      resumeAfterConfirmationId: confirmationId,
      ...(userSession ? { userSession } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || "Unable to resume chat");
    err.status = res.status;
    err.details = data?.error?.details || {};
    throw err;
  }
  return data;
}

export async function generateTestQuestions(agentId, { previousPrompts } = {}) {
  return apiFetch(`/api/agents/${agentId}/test-questions`, {
    method: "POST",
    body: JSON.stringify({ previousPrompts: previousPrompts || [] }),
  });
}
