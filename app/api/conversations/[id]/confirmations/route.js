import { requireAuth } from "@/lib/require-auth";
import { getConversationForUser } from "@/lib/services/conversation.service";
import { createPendingConfirmation } from "@/lib/services/confirmation.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    await getConversationForUser(id, authResult.user.id);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.actionId) {
      return jsonError(request, 400, "Validation failed", {
        actionId: "actionId is required",
      });
    }

    const args =
      body.args && typeof body.args === "object" && !Array.isArray(body.args)
        ? body.args
        : {};

    const confirmation = await createPendingConfirmation(
      id,
      String(body.actionId),
      args
    );
    return jsonOk(request, confirmation, 201);
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404
    ) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("POST /api/conversations/[id]/confirmations", error);
    return jsonError(request, 500, "Unable to create confirmation");
  }
}
