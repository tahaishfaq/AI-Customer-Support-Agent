import { requireAuth } from "@/lib/require-auth";
import { probeConnectionForAgent } from "@/lib/services/connection.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/agents/[id]/connections/[connectionId]/probe
 * Generic host+credential reachability check. No response bodies or secrets.
 */
export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id, connectionId } = await params;
    const limited = await rateLimit(
      `connection-probe:${authResult.user.id}:${id}:${clientIp(request)}`,
      { windowMs: 60_000, limit: 20 }
    );
    if (!limited.ok) {
      return tooManyRequests(limited, "Too many connection probes", request);
    }

    const body = await request.json().catch(() => ({}));
    const path =
      body && typeof body === "object" && typeof body.path === "string"
        ? body.path
        : "/";

    const result = await probeConnectionForAgent(
      id,
      connectionId,
      authResult.user.id,
      { path }
    );
    return jsonOk(request, result, 200);
  } catch (error) {
    if (error.status) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    console.error("POST connection probe", error);
    return jsonError(request, 500, "Unable to probe connection");
  }
}
