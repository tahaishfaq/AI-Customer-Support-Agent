import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { issuePublicRealtimeToken } from "@/lib/realtime/public-access.service";
import { getRealtimeConfig } from "@/lib/realtime/config";
import { originFromRequest } from "@/lib/utils/request-origin";
import { jsonError, jsonOk } from "@/lib/api/error-response";

function accessTokenFromRequest(request) {
  return request.headers.get("x-aide-conversation-access-token")?.trim() || null;
}

export async function POST(request, { params }) {
  const { publicKey, conversationId } = await params;
  const origin = originFromRequest(request);
  const agent = await getPublicAgentByKey(publicKey, { origin });
  if (!agent) return jsonError(request, 404, "Agent not found");

  let body = {};
  try {
    body = await request.json();
  } catch {
    // A subject is optional for anonymous public conversations.
  }

  try {
    const token = await issuePublicRealtimeToken({
      rawAccessToken:
        accessTokenFromRequest(request) || body?.accessToken?.trim() || null,
      conversationId,
      agentId: agent.id,
      origin,
      customerSubject: body?.customerSubject || null,
    });
    return jsonOk(request, { ...token, realtimeUrl: getRealtimeConfig().url }, 201);
  } catch (error) {
    return jsonError(request, error.status || 401, error.message || "Access denied");
  }
}
