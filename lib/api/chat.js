import { apiFetch } from "@/lib/api-client";
import { requestChatStream } from "@/lib/chat/read-chat-response";

export async function sendChatMessage(agentId, { message, conversationId }) {
  const body = { message };
  if (conversationId) body.conversationId = conversationId;

  return apiFetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Shared SSE/JSON transport for sends and approved confirmation resumes. */
export async function sendChatMessageStream(agentId, options) {
  const { message, conversationId, resumeAfterConfirmationId, ...handlers } = options;
  return requestChatStream(`/api/agents/${agentId}/chat`, {
    ...(message === undefined ? {} : { message }),
    ...(conversationId ? { conversationId } : {}),
    ...(resumeAfterConfirmationId ? { resumeAfterConfirmationId } : {}),
  }, handlers);
}

export async function sendPublicChatMessageStream(publicKey, options) {
  const { message, conversationId, resumeAfterConfirmationId, userSession, realtimeAccessToken, ...handlers } = options;
  return requestChatStream(`/api/public/agents/${publicKey}/chat`, {
    ...(message === undefined ? {} : { message }),
    ...(conversationId ? { conversationId } : {}),
    ...(resumeAfterConfirmationId ? { resumeAfterConfirmationId } : {}),
    ...(userSession ? { userSession } : {}),
  }, {
    ...handlers,
    headers: realtimeAccessToken ? { "x-aide-conversation-access-token": realtimeAccessToken } : {},
  });
}

export async function resumeChatAfterConfirmation(agentId, { confirmationId, ...options }) {
  return sendChatMessageStream(agentId, { ...options, resumeAfterConfirmationId: confirmationId });
}

export async function resumePublicChatAfterConfirmation(publicKey, { confirmationId, ...options }) {
  return sendPublicChatMessageStream(publicKey, { ...options, resumeAfterConfirmationId: confirmationId });
}

export async function generateTestQuestions(agentId, { previousPrompts } = {}) {
  return apiFetch(`/api/agents/${agentId}/test-questions`, {
    method: "POST",
    body: JSON.stringify({ previousPrompts: previousPrompts || [] }),
  });
}
