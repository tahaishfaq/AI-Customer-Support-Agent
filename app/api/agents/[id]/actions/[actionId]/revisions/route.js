import { requireAuth } from "@/lib/require-auth";
import {
  createActionDraftRevision,
  listActionRevisions,
} from "@/lib/services/action-revision.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id, actionId } = await params;
    return jsonOk(
      request,
      { revisions: await listActionRevisions(id, actionId, authResult.user.id) },
      200
    );
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to list action revisions");
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(request, 400, "Validation failed", { body: "Invalid JSON body" });
    }
    const { id, actionId } = await params;
    const revision = await createActionDraftRevision(
      id,
      actionId,
      authResult.user.id,
      body
    );
    return jsonOk(request, revision, 201);
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to create action draft revision");
  }
}
