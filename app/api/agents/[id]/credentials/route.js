import { requireAuth } from "@/lib/require-auth";
import {
  createCredentialForAgent,
  listCredentialsForAgent,
} from "@/lib/services/credential.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const credentials = await listCredentialsForAgent(id, authResult.user.id);
    return jsonOk(request, { credentials }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/credentials", error);
    return jsonError(request, 500, "Unable to list credentials");
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(request, 400, "Validation failed", {
        body: "Invalid JSON body",
      });
    }

    const name = String(body.name || "").trim();
    const secret = String(body.secret || "");
    if (!name || !secret) {
      return jsonError(request, 400, "Validation failed", {
        name: !name ? "Name is required" : undefined,
        secret: !secret ? "Secret is required" : undefined,
      });
    }

    const credential = await createCredentialForAgent(id, authResult.user.id, {
      name,
      secret,
      type: body.type,
      headerName: body.headerName,
    });
    return jsonOk(request, credential, 201);
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409 ||
      error.status === 500
    ) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("POST /api/agents/[id]/credentials", error);
    return jsonError(request, 500, "Unable to create credential");
  }
}
