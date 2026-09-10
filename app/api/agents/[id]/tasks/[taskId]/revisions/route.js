import { requireAuth } from "@/lib/require-auth";
import { createTaskDraftRevision, listTaskRevisions } from "@/lib/services/task.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id, taskId } = await params;
    return jsonOk(request, { revisions: await listTaskRevisions(id, taskId, authResult.user.id) });
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to list task revisions");
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(request, 400, "Validation failed", { body: "Invalid JSON body" });
    }
    const { id, taskId } = await params;
    return jsonOk(request, await createTaskDraftRevision(id, taskId, authResult.user.id, body), 201);
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to create task revision");
  }
}
