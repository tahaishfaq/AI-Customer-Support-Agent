import { sendChatMessage } from "@/lib/services/chat.service";
import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pubChatLimitOpts } from "@/lib/rate-limit-config";
import { originFromRequest } from "@/lib/utils/request-origin";
import { chatMessageSchema, zodErrorDetails } from "@/lib/validations/chat";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { durationHeaders, durationMsSince } from "@/lib/observability/duration";
import { safeLogError } from "@/lib/observability/safe-log";
import { streamingChatEnabled } from "@/lib/chat/sse";
import { createChatServerStream } from "@/lib/chat/server-stream";

/** Keep above OPENAI_TIMEOUT_MS (default 45s). */
export const maxDuration = 60;

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);
  const started = Date.now();
  let agentId;

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
    agentId = agent.id;

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

    const authHeader = request.headers.get("authorization") || "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const bearerToken = bearerMatch?.[1]?.trim() || null;

    const wantsStream =
      Boolean(parsed.data.stream) &&
      streamingChatEnabled() &&
      (request.headers.get("accept") || "").includes("text/event-stream");

    if (wantsStream) {
      const stream = createChatServerStream(async ({ emit, signal }) => {
            return sendChatMessage(agent.id, {
              publicAccess: true,
              message: parsed.data.message,
              conversationId: parsed.data.conversationId,
              resumeAfterConfirmationId: parsed.data.resumeAfterConfirmationId,
              identityToken:
                parsed.data.identityToken ||
                request.headers.get("x-customer-identity") ||
                request.headers.get("x-identity-token") ||
                null,
              userSession: parsed.data.userSession || null,
              bearerToken,
              realtimeAccessToken: request.headers.get("x-aide-conversation-access-token"),
              requestOrigin: originFromRequest(request),
              requestId,
              signal,
              stream: { emit },
            });
      }, {
        signal: request.signal,
        onError: () => safeLogError("chat stream failed", { requestId, agentId, route: "public-chat", status: 500 }),
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "x-request-id": requestId,
          ...durationHeaders(started),
        },
      });
    }

    const result = await sendChatMessage(agent.id, {
      publicAccess: true,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      resumeAfterConfirmationId: parsed.data.resumeAfterConfirmationId,
      identityToken:
        parsed.data.identityToken ||
        request.headers.get("x-customer-identity") ||
        request.headers.get("x-identity-token") ||
        null,
      userSession: parsed.data.userSession || null,
      bearerToken,
      realtimeAccessToken: request.headers.get("x-aide-conversation-access-token"),
      requestOrigin: originFromRequest(request),
      requestId,
      signal: request.signal,
    });

    return jsonOk(request, result, 200, durationHeaders(started));
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 401 ||
      error.status === 402 ||
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
      agentId,
      route: "public-chat",
      status: 500,
      durationMs: durationMsSince(started),
    });
    return jsonError(request, 500, "Unable to process chat");
  }
}
