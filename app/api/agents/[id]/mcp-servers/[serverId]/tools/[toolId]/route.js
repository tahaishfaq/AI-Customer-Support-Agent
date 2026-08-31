import { requireAuth } from "@/lib/require-auth";
import { updateMcpToolForAgent } from "@/lib/services/mcp.service";
import {
  updateMcpToolSchema,
  zodErrorDetails,
} from "@/lib/validations/mcp";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, serverId, toolId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(request, 400, "Validation failed", {
        body: "Invalid JSON body",
      });
    }

    const parsed = updateMcpToolSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        request,
        400,
        "Validation failed",
        zodErrorDetails(parsed.error)
      );
    }

    const tool = await updateMcpToolForAgent(
      id,
      serverId,
      toolId,
      authResult.user.id,
      parsed.data
    );
    return jsonOk(request, { tool }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404 || error.status === 400) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    console.error(
      "PATCH /api/agents/[id]/mcp-servers/[serverId]/tools/[toolId]",
      error
    );
    return jsonError(request, 500, "Unable to update MCP tool");
  }
}
