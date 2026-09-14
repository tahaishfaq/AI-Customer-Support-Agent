import { requireAuth } from "@/lib/require-auth";
import { createConnectionRevisionForAgent } from "@/lib/services/connection.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(request, 400, "Validation failed", { body: "Invalid JSON body" });
    }
    const { id, connectionId } = await params;
    const revision = await createConnectionRevisionForAgent(
      id,
      connectionId,
      authResult.user.id,
      body
    );
    return jsonOk(request, revision, 201);
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to create connection revision");
  }
}
