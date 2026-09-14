import { requireAuth } from "@/lib/require-auth";
import {
  createConnectionForAgent,
  listConnectionsForAgent,
} from "@/lib/services/connection.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id } = await params;
    return jsonOk(
      request,
      { connections: await listConnectionsForAgent(id, authResult.user.id) },
      200
    );
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to list connections");
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(request, 400, "Validation failed", { body: "Invalid JSON body" });
    }
    const { id } = await params;
    const connection = await createConnectionForAgent(id, authResult.user.id, body);
    return jsonOk(request, connection, 201);
  } catch (error) {
    if (error.status) return jsonError(request, error.status, error.message, error.details || {});
    return jsonError(request, 500, "Unable to create connection");
  }
}
