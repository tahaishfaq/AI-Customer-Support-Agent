import { requireAdmin } from "@/lib/require-admin";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { getAgentTurnTraceForAdmin } from "@/lib/services/agent-trace.service";

/**
 * Admin Agent Trace — reconstruct one TurnRun without provider bodies.
 */
export async function GET(request, { params }) {
  const authResult = await requireAdmin(request);
  if (authResult.error) return authResult.error;

  try {
    const { turnRunId } = await params;
    const trace = await getAgentTurnTraceForAdmin(turnRunId);
    return jsonOk(request, { trace }, 200);
  } catch (error) {
    if (error.status === 404) {
      return jsonError(request, 404, error.message);
    }
    console.error("GET /api/admin/traces/[turnRunId]", error);
    return jsonError(request, 500, "Unable to load admin agent trace");
  }
}
