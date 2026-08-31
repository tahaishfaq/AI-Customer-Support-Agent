import { requireAuth } from "@/lib/require-auth";
import { testActionForAgent } from "@/lib/services/action.service";
import {
  testAgentActionSchema,
  zodErrorDetails,
} from "@/lib/validations/actions";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, actionId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = testAgentActionSchema.safeParse(body || {});
    if (!parsed.success) {
      return jsonError(request, 400, "Validation failed", zodErrorDetails(parsed.error));
    }

    const result = await testActionForAgent(
      id,
      actionId,
      authResult.user.id,
      parsed.data
    );
    return jsonOk(request, result, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404 || error.status === 400) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("POST /api/agents/[id]/actions/[actionId]/test", error);
    return jsonError(request, 500, "Unable to test action");
  }
}
