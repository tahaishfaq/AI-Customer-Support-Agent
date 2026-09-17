import { requireAuth } from "@/lib/require-auth";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { getAgentTurnTraceForOwner } from "@/lib/services/agent-trace.service";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, turnRunId } = await params;
    const trace = await getAgentTurnTraceForOwner(
      id,
      turnRunId,
      authResult.user.id
    );
    return jsonOk(request, { trace }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/traces/[turnRunId]", error);
    return jsonError(request, 500, "Unable to load agent trace");
  }
}
