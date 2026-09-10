import { requireAuth } from "@/lib/require-auth";
import { publishActionRevision } from "@/lib/services/action-revision.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id, actionId, revisionId } = await params;
    const revision = await publishActionRevision(
      id,
      actionId,
      revisionId,
      authResult.user.id
    );
    return jsonOk(request, revision, 200);
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to publish action revision");
  }
}
