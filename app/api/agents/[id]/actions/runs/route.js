import { requireAuth } from "@/lib/require-auth";
import { listToolRunsForAgent } from "@/lib/services/action.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const url = new URL(request.url);
    const take = Number(url.searchParams.get("take") || 30);
    const runs = await listToolRunsForAgent(id, authResult.user.id, { take });
    return jsonOk(request, { runs }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/actions/runs", error);
    return jsonError(request, 500, "Unable to list tool runs");
  }
}
