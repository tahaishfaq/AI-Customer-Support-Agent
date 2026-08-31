import { requireAuth } from "@/lib/require-auth";
import { listUnhelpfulRepliesForAgent } from "@/lib/services/feedback.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || 12;
    const result = await listUnhelpfulRepliesForAgent(id, authResult.user.id, {
      limit,
    });
    return jsonOk(request, result, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/feedback", error);
    return jsonError(request, 500, "Unable to load feedback");
  }
}
