import { requireAuth } from "@/lib/require-auth";
import {
  deleteActionForAgent,
  updateActionForAgent,
} from "@/lib/services/action.service";
import {
  updateAgentActionSchema,
  zodErrorDetails,
} from "@/lib/validations/actions";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, actionId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(request, 400, "Validation failed", {
        body: "Invalid JSON body",
      });
    }

    const parsed = updateAgentActionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(request, 400, "Validation failed", zodErrorDetails(parsed.error));
    }

    const action = await updateActionForAgent(
      id,
      actionId,
      authResult.user.id,
      parsed.data
    );
    return jsonOk(request, action, 200);
  } catch (error) {
    if (
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409 ||
      error.status === 400
    ) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("PATCH /api/agents/[id]/actions/[actionId]", error);
    return jsonError(request, 500, "Unable to update action");
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, actionId } = await params;
    const result = await deleteActionForAgent(id, actionId, authResult.user.id);
    return jsonOk(request, result, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("DELETE /api/agents/[id]/actions/[actionId]", error);
    return jsonError(request, 500, "Unable to delete action");
  }
}
