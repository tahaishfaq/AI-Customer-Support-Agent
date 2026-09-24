import { sendChatMessage } from "@/lib/services/chat.service";
import { requireAuth } from "@/lib/require-auth";
import {
  chatMessageSchema,
  zodErrorDetails,
} from "@/lib/validations/chat";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { studioChatLimitOpts } from "@/lib/rate-limit-config";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { durationHeaders, durationMsSince } from "@/lib/observability/duration";
import { safeLogError } from "@/lib/observability/safe-log";
import {
  acceptsNdjson,
  NDJSON_CONTENT_TYPE,
  streamingChatEnabled,
} from "@/lib/chat/ndjson";
import { createChatServerStream } from "@/lib/chat/server-stream";

/** Keep above OPENAI_TIMEOUT_MS (default 45s). */
export const maxDuration = 60;

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);
  const started = Date.now();
  const { id: agentId } = await params;

  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const limited = await rateLimit(
      `studio-chat:${authResult.user.id}:${agentId}:${clientIp(request)}`,
      studioChatLimitOpts()
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many messages. Try again shortly.",
        request
      );
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

    const wantsStream =
      Boolean(parsed.data.stream) &&
      streamingChatEnabled() &&
      acceptsNdjson(request);

    if (wantsStream) {
      const stream = createChatServerStream(async ({ emit, signal }) => {
            return sendChatMessage(agentId, authResult.user.id, {
              message: parsed.data.message,
              conversationId: parsed.data.conversationId,
              clientMessageId: parsed.data.clientMessageId,
              resumeAfterConfirmationId: parsed.data.resumeAfterConfirmationId,
              identityToken:
                parsed.data.identityToken ||
                request.headers.get("x-customer-identity") ||
                request.headers.get("x-identity-token") ||
                null,
              requestId,
              signal,
              stream: { emit },
            });
      }, {
        signal: request.signal,
        turnId: parsed.data.clientMessageId || null,
        onError: () => safeLogError("chat stream failed", { requestId, agentId, route: "studio-chat", status: 500 }),
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": `${NDJSON_CONTENT_TYPE}; charset=utf-8`,
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "x-request-id": requestId,
          ...durationHeaders(started),
        },
      });
    }

    const result = await sendChatMessage(agentId, authResult.user.id, {
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      clientMessageId: parsed.data.clientMessageId,
      resumeAfterConfirmationId: parsed.data.resumeAfterConfirmationId,
      identityToken:
        parsed.data.identityToken ||
        request.headers.get("x-customer-identity") ||
        request.headers.get("x-identity-token") ||
        null,
      requestId,
      signal: request.signal,
    });

    // No streaming yet → TTFT ≈ total wall time (header for F02 baselines).
    return jsonOk(request, result, 200, durationHeaders(started));
  } catch (error) {
    if (error?.code === "CONVERSATION_OWNERSHIP_CHANGED") {
      return jsonError(
        request,
        409,
        "Conversation changed during this reply. Start a new message.",
        { code: error.code }
      );
    }
    if (
      error.status === 400 ||
      error.status === 401 ||
      error.status === 402 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409 ||
      error.status === 500 ||
      error.status === 502 ||
      error.status === 503
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    safeLogError("POST /api/agents/[id]/chat", {
      requestId,
      agentId,
      route: "studio-chat",
      status: 500,
      durationMs: durationMsSince(started),
      code: error?.code || null,
    });
    return jsonError(request, 500, "Unable to process chat");
  }
}
