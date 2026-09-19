import { requireAuth } from "@/lib/require-auth";
import { probeDraftMcpServerForAgent } from "@/lib/services/mcp.service";
import {
  probeDraftMcpServerSchema,
  zodErrorDetails,
} from "@/lib/validations/mcp";
import { jsonError, jsonOk } from "@/lib/api/error-response";

/**
 * POST — ephemeral MCP tools/list (no durable server row).
 */
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

    const parsed = probeDraftMcpServerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        request,
        400,
        "Validation failed",
        zodErrorDetails(parsed.error)
      );
    }

    const result = await probeDraftMcpServerForAgent(
      id,
      authResult.user.id,
      parsed.data
    );
    return jsonOk(request, result, 200);
  } catch (error) {
    if (
      error.status === 403 ||
      error.status === 404 ||
      error.status === 400 ||
      error.status === 429
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    console.error("POST /api/agents/[id]/mcp-servers/probe-draft", error);
    return jsonError(request, 500, "Unable to probe MCP server");
  }
}
