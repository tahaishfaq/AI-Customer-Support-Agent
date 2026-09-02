import { requireAuth } from "@/lib/require-auth";
import {
  deleteMcpServerForAgent,
  getMcpServerForAgent,
  updateMcpServerForAgent,
} from "@/lib/services/mcp.service";
import {
  updateMcpServerSchema,
  zodErrorDetails,
} from "@/lib/validations/mcp";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, serverId } = await params;
    const server = await getMcpServerForAgent(id, serverId, authResult.user.id);
    return jsonOk(request, { server }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/mcp-servers/[serverId]", error);
    return jsonError(request, 500, "Unable to load MCP server");
  }
}

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, serverId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(request, 400, "Validation failed", {
        body: "Invalid JSON body",
      });
    }

    const parsed = updateMcpServerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        request,
        400,
        "Validation failed",
        zodErrorDetails(parsed.error)
      );
    }

    const server = await updateMcpServerForAgent(
      id,
      serverId,
      authResult.user.id,
      parsed.data
    );
    return jsonOk(request, { server }, 200);
  } catch (error) {
    if (
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409 ||
      error.status === 400
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    console.error("PATCH /api/agents/[id]/mcp-servers/[serverId]", error);
    return jsonError(request, 500, "Unable to update MCP server");
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, serverId } = await params;
    await deleteMcpServerForAgent(id, serverId, authResult.user.id);
    return jsonOk(request, { ok: true }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("DELETE /api/agents/[id]/mcp-servers/[serverId]", error);
    return jsonError(request, 500, "Unable to delete MCP server");
  }
}
