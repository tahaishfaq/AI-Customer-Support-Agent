import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { mcpProbeLimitOpts } from "@/lib/rate-limit-config";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { probeMcpServerForAgent } from "@/lib/services/mcp.service";
import { requireAuth } from "@/lib/require-auth";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, serverId } = await params;
    const limited = rateLimit(
      `mcp-probe:${authResult.user.id}:${id}`,
      mcpProbeLimitOpts()
    );
    if (!limited.ok) {
      return tooManyRequests(limited, "Too many MCP probes. Try again shortly.");
    }

    const result = await probeMcpServerForAgent(
      id,
      serverId,
      authResult.user.id
    );
    return jsonOk(request, result, 200);
  } catch (error) {
    if (
      error.status === 403 ||
      error.status === 404 ||
      error.status === 400 ||
      error.status === 502 ||
      error.status === 504
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    console.error("POST /api/agents/[id]/mcp-servers/[serverId]/probe", error);
    return jsonError(request, 500, "Unable to probe MCP server");
  }
}
