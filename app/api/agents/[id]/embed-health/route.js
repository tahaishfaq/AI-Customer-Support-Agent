import { requireAuth } from "@/lib/require-auth";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  getEmbedReadiness,
  retestEmbedReadiness,
} from "@/lib/services/embed-readiness.service";

export const maxDuration = 60;

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const data = await getEmbedReadiness(id, authResult.user.id);
    return jsonOk(request, data, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/embed-health", error);
    return jsonError(request, 500, "Unable to load embed health");
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const limited = rateLimit(`embed-health:${authResult.user.id}:${id}`, {
      limit: 4,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many embed tests. Try again shortly.",
        request
      );
    }

    const data = await retestEmbedReadiness(id, authResult.user.id);
    return jsonOk(request, data, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404 || error.status === 429) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("POST /api/agents/[id]/embed-health", error);
    return jsonError(request, 500, "Unable to retest embed health");
  }
}
