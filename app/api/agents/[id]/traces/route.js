import { requireAuth } from "@/lib/require-auth";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { listAgentTurnTracesForOwner } from "@/lib/services/agent-trace.service";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    const take = url.searchParams.get("take");

    const result = await listAgentTurnTracesForOwner(id, authResult.user.id, {
      conversationId: conversationId || null,
      take: take ? Number(take) : 20,
    });
    return jsonOk(request, result, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/traces", error);
    return jsonError(request, 500, "Unable to list agent traces");
  }
}
