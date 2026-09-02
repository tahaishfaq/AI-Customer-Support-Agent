import { requireAuth } from "@/lib/require-auth";
import { getConversationForUser } from "@/lib/services/conversation.service";
import {
  approveConfirmation,
  denyConfirmation,
} from "@/lib/services/confirmation.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { studioConfirmLimitOpts } from "@/lib/rate-limit-config";

/**
 * F14-A/B/E — Approve (default) or deny a pending confirmation + stamp evidence.
 * Body optional: `{ decision?: "approve" | "deny", userSubject?, userDisplay? }`
 */
export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, confirmationId } = await params;
    const ip = clientIp(request);
    const limited = rateLimit(
      `studio-confirm:${authResult.user.id}:${id}:${ip}`,
      studioConfirmLimitOpts()
    );
    if (!limited.ok) {
      return jsonError(
        request,
        429,
        "Too many confirmation attempts. Try again shortly.",
        {},
        { "Retry-After": String(limited.retryAfterSec) }
      );
    }

    await getConversationForUser(id, authResult.user.id);

    const body = await request.json().catch(() => ({}));
    const decision =
      String(body?.decision || "approve").toLowerCase() === "deny"
        ? "deny"
        : "approve";

    const evidence = {
      userSubject: body?.userSubject,
      userDisplay: body?.userDisplay,
      clientIp: clientIp(request),
    };

    const confirmation =
      decision === "deny"
        ? await denyConfirmation(confirmationId, id, evidence)
        : await approveConfirmation(confirmationId, id, evidence);

    return jsonOk(request, confirmation, 200);
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 429
    ) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error(
      "POST /api/conversations/[id]/confirmations/[confirmationId]",
      error
    );
    return jsonError(request, 500, "Unable to resolve confirmation");
  }
}
