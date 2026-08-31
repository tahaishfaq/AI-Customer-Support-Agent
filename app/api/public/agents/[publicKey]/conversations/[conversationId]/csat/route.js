import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { setConversationCsat } from "@/lib/services/handoff.service";
import { deskCsatBodySchema, zodErrorDetails } from "@/lib/validations/desk";
import { originFromRequest } from "@/lib/utils/request-origin";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);

  try {
    const { publicKey, conversationId } = await params;
    const agent = await getPublicAgentByKey(publicKey, {
      origin: originFromRequest(request),
    });
    if (!agent) {
      return jsonError(request, 404, "Agent not found");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = deskCsatBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(request, 400, "Validation failed", zodErrorDetails(parsed.error));
    }

    const result = await setConversationCsat({
      conversationId,
      agentId: agent.id,
      score: parsed.data.skip ? null : parsed.data.score,
      skip: Boolean(parsed.data.skip),
    });

    return jsonOk(request, result, 200);
  } catch (error) {
    if (error.status) {
      return jsonError(request, error.status, error.message, error.details);
    }
    safeLogError("POST public conversation csat", {
      requestId,
      route: "public-csat",
      status: 500,
    });
    return jsonError(request, 500, "Unable to save rating");
  }
}
