import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { mergeCustomization } from "@/lib/customization/defaults";
import { setMessageFeedback } from "@/lib/services/feedback.service";
import { originFromRequest } from "@/lib/utils/request-origin";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);

  try {
    const { publicKey } = await params;
    const agent = await getPublicAgentByKey(publicKey, {
      origin: originFromRequest(request),
    });
    if (!agent) {
      return jsonError(request, 404, "Agent not found");
    }
    if (!mergeCustomization(agent.customization).features.messageFeedback) {
      return jsonError(request, 403, "Feedback is disabled for this agent");
    }

    const body = await request.json().catch(() => ({}));
    const messageId = String(body.messageId || "");
    const rating = body.rating === "DOWN" ? "DOWN" : "UP";
    if (!messageId) {
      return jsonError(request, 400, "Validation failed", {
        messageId: "Required",
      });
    }

    const result = await setMessageFeedback(messageId, rating, {
      agentId: agent.id,
      reason: body.reason,
    });
    return jsonOk(request, result, 200);
  } catch (error) {
    if (error.status) {
      return jsonError(request, error.status, error.message);
    }
    safeLogError("POST /api/public/agents/[publicKey]/feedback", {
      requestId,
      route: "public-feedback",
      status: 500,
    });
    return jsonError(request, 500, "Unable to save feedback");
  }
}
