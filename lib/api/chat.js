import { apiFetch } from "@/lib/api-client";

export async function sendChatMessage(agentId, { message, conversationId }) {
  const body = { message };
  if (conversationId) body.conversationId = conversationId;

  return apiFetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
