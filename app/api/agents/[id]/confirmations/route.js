import { requireAuth } from "@/lib/require-auth";
import { listConfirmationsForAgent } from "@/lib/services/confirmation.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

/**
 * F14-B — Owner audit list of action confirmations for an agent.
 */
export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const url = new URL(request.url);
    const take = Number(url.searchParams.get("take") || 30);
    const confirmations = await listConfirmationsForAgent(
      id,
      authResult.user.id,
      { take }
    );
    return jsonOk(request, { confirmations }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/confirmations", error);
    return jsonError(request, 500, "Unable to list confirmations");
  }
}
