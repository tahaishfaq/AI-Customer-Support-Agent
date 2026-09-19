import { requireAuth } from "@/lib/require-auth";
import {
  getGithubMcpOauthStatus,
  startGithubMcpOauthForAgent,
} from "@/lib/services/mcp-github-oauth.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

/** GET — whether platform GitHub OAuth App is configured (no secrets). */
export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    return jsonOk(request, getGithubMcpOauthStatus(), 200);
  } catch (error) {
    console.error("GET github-oauth status", error);
    return jsonError(request, 500, "Unable to read GitHub OAuth status");
  }
}

/**
 * POST — create/link GitHub MCP server + return authorize URL.
 * Body optional: { name?, url?, serverId? }
 */
export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await startGithubMcpOauthForAgent(
      id,
      authResult.user.id,
      body && typeof body === "object" ? body : {}
    );
    return jsonOk(request, result, 200);
  } catch (error) {
    if (
      error.status === 403 ||
      error.status === 404 ||
      error.status === 400 ||
      error.status === 503
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    console.error("POST github-oauth/start", error);
    return jsonError(request, 500, "Unable to start GitHub MCP OAuth");
  }
}
