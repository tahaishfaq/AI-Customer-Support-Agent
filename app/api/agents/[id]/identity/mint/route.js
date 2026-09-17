import { requireAuth } from "@/lib/require-auth";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { mintEndUserIdentityToken } from "@/lib/actions/identity";
import { getAgentForUser } from "@/lib/services/agent.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/agents/[id]/identity/mint
 * Owner-only: mint a short-lived Aide-signed identity JWT for studio/backend tests.
 * Never log the token. Do not call from public embed JS.
 */
export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const agent = await getAgentForUser(id, authResult.user.id);
    if (!canManageAgentActions({ userId: authResult.user.id, agent })) {
      return jsonError(request, 403, "Not allowed to mint identity tokens");
    }

    const limited = await rateLimit(`identity-mint:${authResult.user.id}`, {
      windowMs: 60_000,
      limit: 30,
    });
    if (!limited.ok) {
      return jsonError(request, 429, "Too many identity mint requests");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(request, 400, "Validation failed", {
        body: "JSON object required",
      });
    }
    if (!body.sub || typeof body.sub !== "string") {
      return jsonError(request, 400, "Validation failed", {
        sub: "sub (end-user subject) is required",
      });
    }

    const minted = mintEndUserIdentityToken({
      sub: body.sub,
      ttlSeconds: body.ttlSeconds,
      email: body.email,
      phone: body.phone,
      iss: body.iss || `aide:agent:${id}`,
      aud: body.aud || "aide-embed",
    });

    return jsonOk(
      request,
      {
        token: minted.token,
        sub: minted.sub,
        expiresAt: minted.expiresAt,
        ttlSeconds: minted.ttlSeconds,
        strategy: "hs256_jwt",
        usage:
          "Pass as aideChat.setUser({ subject, accessToken: token }) or Authorization: Bearer <token>. Do not put ACTIONS_IDENTITY_SECRET in the browser.",
      },
      201
    );
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 401 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 500
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.code ? { code: error.code } : {}
      );
    }
    console.error("POST /api/agents/[id]/identity/mint", error);
    return jsonError(request, 500, "Unable to mint identity token");
  }
}
