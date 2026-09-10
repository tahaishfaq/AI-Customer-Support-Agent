import { requireAuth } from "@/lib/require-auth";
import { publishTaskRevision } from "@/lib/services/task.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id, taskId, revisionId } = await params;
    return jsonOk(
      request,
      await publishTaskRevision(id, taskId, revisionId, authResult.user.id)
    );
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to publish task revision");
  }
}
