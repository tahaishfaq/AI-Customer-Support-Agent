import { requireAuth } from "@/lib/require-auth";
import {
  revokeCredentialForAgent,
  rotateCredentialForAgent,
} from "@/lib/services/credential.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, credentialId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.secret) {
      return jsonError(request, 400, "Validation failed", {
        secret: "Secret is required",
      });
    }

    const credential = await rotateCredentialForAgent(
      id,
      credentialId,
      authResult.user.id,
      { secret: String(body.secret) }
    );
    return jsonOk(request, credential, 200);
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 500
    ) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("POST /api/agents/[id]/credentials/[credentialId]", error);
    return jsonError(request, 500, "Unable to rotate credential");
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, credentialId } = await params;
    const credential = await revokeCredentialForAgent(
      id,
      credentialId,
      authResult.user.id
    );
    return jsonOk(request, credential, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("DELETE /api/agents/[id]/credentials/[credentialId]", error);
    return jsonError(request, 500, "Unable to revoke credential");
  }
}
