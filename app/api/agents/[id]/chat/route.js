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
import { formatSseEvent, streamingChatEnabled } from "@/lib/chat/sse";

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
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event) => {
            controller.enqueue(
              encoder.encode(formatSseEvent(event.type, event.data))
            );
          };
          try {
            await sendChatMessage(agentId, authResult.user.id, {
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
              stream: { emit },
            });
          } catch (error) {
            emit({
              type: "error",
              data: {
                message: error.message || "Unable to process chat",
                code: error?.details?.code || error?.code || null,
              },
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
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
      error.status === 502
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
