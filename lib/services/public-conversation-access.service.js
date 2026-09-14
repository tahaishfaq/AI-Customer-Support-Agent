import { verifyPublicConversationAccess } from "@/lib/realtime/public-access.service";

export function publicAccessTokenFromRequest(request) {
  return request.headers.get("x-aide-conversation-access-token")?.trim() || null;
}

export async function requirePublicConversationAccess({
  request,
  conversationId,
  agentId,
  origin,
  customerSubject,
  rawToken = null,
}) {
  const token = rawToken || publicAccessTokenFromRequest(request);
  if (!token) {
    const error = new Error("Public conversation access required");
    error.status = 401;
    error.details = { code: "PUBLIC_CONVERSATION_ACCESS_REQUIRED" };
    throw error;
  }

  const access = await verifyPublicConversationAccess({
    rawToken: token,
    conversationId,
    agentId,
    origin,
    ...(customerSubject !== undefined ? { customerSubject } : {}),
  });
  if (!access) {
    const error = new Error("Public conversation access denied");
    error.status = 401;
    error.details = { code: "PUBLIC_CONVERSATION_ACCESS_INVALID" };
    throw error;
  }
  return access;
}
