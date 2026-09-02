import { triggerHandoff } from "@/lib/services/handoff.service";
import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { handoffLimitOpts } from "@/lib/rate-limit-config";
import { originFromRequest } from "@/lib/utils/request-origin";
import {
  handoffBodySchema,
  zodErrorDetails,
} from "@/lib/validations/desk";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);

  try {
    const { publicKey, conversationId } = await params;
    const ip = clientIp(request);
    const limited = rateLimit(
      `handoff:${publicKey}:${conversationId}:${ip}`,
      handoffLimitOpts()
    );
    if (!limited.ok) {
      return jsonError(
        request,
        429,
        "Too many handoff requests. Try again shortly.",
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

    let body = {};
    try {
      const raw = await request.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return jsonError(request, 400, "Validation failed", {
        body: "Invalid JSON body",
      });
    }

    const parsed = handoffBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        request,
        400,
        "Validation failed",
        zodErrorDetails(parsed.error)
      );
    }

    const result = await triggerHandoff({
      conversationId,
      publicAgentId: agent.id,
      reason: parsed.data.reason,
    });

    return jsonOk(request, result, 200);
  } catch (error) {
    if (
      error.status === 404 ||
      error.status === 409 ||
      error.status === 429
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {},
        error.status === 429 && error.details?.cooldownMs
          ? {
              "Retry-After": String(
                Math.max(1, Math.ceil(Number(error.details.cooldownMs) / 1000))
              ),
            }
          : undefined
      );
    }
    safeLogError("POST public handoff", {
      requestId,
      route: "public-handoff",
      status: 500,
      message: String(error?.message || "").slice(0, 200),
    });
    return jsonError(request, 500, "Unable to request human support");
  }
}
