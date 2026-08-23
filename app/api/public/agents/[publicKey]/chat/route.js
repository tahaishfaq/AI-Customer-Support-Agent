import { sendChatMessage } from "@/lib/services/chat.service";
import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pubChatLimitOpts } from "@/lib/rate-limit-config";
import { originFromRequest } from "@/lib/utils/request-origin";
import { chatMessageSchema, zodErrorDetails } from "@/lib/validations/chat";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";

/** Keep above OPENAI_TIMEOUT_MS (default 45s). */
export const maxDuration = 60;

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);

  try {
    const { publicKey } = await params;
    const ip = clientIp(request);
    const limited = rateLimit(
      `pub-chat:${publicKey}:${ip}`,
      pubChatLimitOpts()
    );
    if (!limited.ok) {
      return jsonError(
        request,
        429,
        "Too many messages. Try again shortly.",
        {},
        { "Retry-After": String(limited.retryAfterSec) }
      );
    }

    const agent = await getPublicAgentByKey(publicKey, {
      origin: originFromRequest(request),
    });
    if (!agent) {
      return jsonError(request, 404, "Agent not found");
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError(request, 400, "Validation failed", {
        body: "Invalid JSON body",
      });
    }

    const parsed = chatMessageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        request,
        400,
        "Validation failed",
        zodErrorDetails(parsed.error)
      );
    }

    const result = await sendChatMessage(agent.id, {
      publicAccess: true,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      requestId,
      signal: request.signal,
    });

    return jsonOk(request, result, 200);
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 502
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    safeLogError("POST /api/public/agents/[publicKey]/chat", {
      requestId,
      route: "public-chat",
      status: 500,
    });
    return jsonError(request, 500, "Unable to process chat");
  }
}
