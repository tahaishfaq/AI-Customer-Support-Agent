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
import { streamingChatEnabled } from "@/lib/chat/sse";
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
    const limited = rateLimit(
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
      (request.headers.get("accept") || "").includes("text/event-stream");

    if (wantsStream) {
      const stream = createChatServerStream(async ({ emit, signal }) => {
            return sendChatMessage(agentId, authResult.user.id, {
              message: parsed.data.message,
              conversationId: parsed.data.conversationId,
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
        onError: () => safeLogError("chat stream failed", { requestId, agentId, route: "studio-chat", status: 500 }),
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

    const result = await sendChatMessage(agentId, authResult.user.id, {
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
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
    if (
      error.status === 400 ||
      error.status === 401 ||
      error.status === 402 ||
      error.status === 403 ||
      error.status === 404 ||
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
    });
    return jsonError(request, 500, "Unable to process chat");
  }
}
