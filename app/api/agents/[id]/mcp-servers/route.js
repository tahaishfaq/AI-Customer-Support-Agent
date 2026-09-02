import { requireAuth } from "@/lib/require-auth";
import {
  createMcpServerForAgent,
  listMcpServersForAgent,
} from "@/lib/services/mcp.service";
import {
  createMcpServerSchema,
  zodErrorDetails,
} from "@/lib/validations/mcp";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const servers = await listMcpServersForAgent(id, authResult.user.id);
    return jsonOk(request, { servers }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/mcp-servers", error);
    return jsonError(request, 500, "Unable to list MCP servers");
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

    const parsed = createMcpServerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        request,
        400,
        "Validation failed",
        zodErrorDetails(parsed.error)
      );
    }

    const server = await createMcpServerForAgent(
      id,
      authResult.user.id,
      parsed.data
    );
    return jsonOk(request, { server }, 201);
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
    console.error("POST /api/agents/[id]/mcp-servers", error);
    return jsonError(request, 500, "Unable to create MCP server");
  }
}
