import { requireAuth } from "@/lib/require-auth";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { rateLimit } from "@/lib/rate-limit";
import { COPILOT_RATE_LIMIT } from "@/lib/desk/copilot";

const PASS_THROUGH = new Set([402, 403, 404, 409, 429, 499, 502, 503, 504]);

/**
 * Shared POST handler for the desk copilot routes (Level 2 · M4): auth, platform-admin block,
 * per-user rate limit, then the service. The draft/summary is never logged.
 */
export async function handleCopilotRequest(request, params, run, label) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    if (authResult.user.role === "ADMIN") {
      return jsonError(request, 403, "Platform admin cannot use the desk copilot");
    }

    const limited = await rateLimit(`desk-copilot:${authResult.user.id}`, COPILOT_RATE_LIMIT);
    if (!limited.ok) {
      return jsonError(
        request,
        429,
        "Too many suggestions. Try again in a minute.",
        { code: "COPILOT_RATE_LIMITED" },
        { "Retry-After": String(limited.retryAfterSec) }
      );
    }

    const { id } = await params;
    const result = await run({ conversationId: id, userId: authResult.user.id, signal: request.signal });
    return jsonOk(request, result, 200);
  } catch (error) {
    if (PASS_THROUGH.has(error.status)) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error(`POST /api/conversations/[id]/${label}`, error?.status || error?.message);
    return jsonError(request, 500, "Copilot is unavailable right now");
  }
}
