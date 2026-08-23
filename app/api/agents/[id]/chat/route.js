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
import { durationHeaders } from "@/lib/observability/duration";
import { safeLogError } from "@/lib/observability/safe-log";

/** Keep above OPENAI_TIMEOUT_MS (default 45s). */
export const maxDuration = 60;

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);
  const started = Date.now();

  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id: agentId } = await params;
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

    const result = await sendChatMessage(agentId, authResult.user.id, {
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      requestId,
      signal: request.signal,
    });

    // No streaming yet → TTFT ≈ total wall time (header for F02 baselines).
    return jsonOk(request, result, 200, durationHeaders(started));
  } catch (error) {
    if (
      error.status === 400 ||
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
      route: "studio-chat",
      status: 500,
    });
    return jsonError(request, 500, "Unable to process chat");
  }
}
