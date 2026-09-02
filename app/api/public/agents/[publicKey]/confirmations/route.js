import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { createPendingConfirmation } from "@/lib/services/confirmation.service";
import prisma from "@/lib/prisma";
import { originFromRequest } from "@/lib/utils/request-origin";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pubChatLimitOpts } from "@/lib/rate-limit-config";

export async function POST(request, { params }) {
  try {
    const { publicKey } = await params;
    const ip = clientIp(request);
    const limited = rateLimit(
      `pub-confirm:${publicKey}:${ip}`,
      pubChatLimitOpts()
    );
    if (!limited.ok) {
      return jsonError(
        request,
        429,
        "Too many requests. Try again shortly.",
        {},
        { "Retry-After": String(limited.retryAfterSec) }
      );
    }

    const agent = await getPublicAgentByKey(publicKey, {
      origin: originFromRequest(request),
    });
    if (!agent) {
      return jsonError(request, 404, "Agent not found");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.actionId || !body.conversationId) {
      return jsonError(request, 400, "Validation failed", {
        actionId: !body?.actionId ? "actionId is required" : undefined,
        conversationId: !body?.conversationId
          ? "conversationId is required"
          : undefined,
      });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: String(body.conversationId) },
      select: { id: true, agentId: true },
    });
    if (!conversation || conversation.agentId !== agent.id) {
      return jsonError(request, 404, "Conversation not found");
    }

    const args =
      body.args && typeof body.args === "object" && !Array.isArray(body.args)
        ? body.args
        : {};

    const confirmation = await createPendingConfirmation(
      conversation.id,
      String(body.actionId),
      args
    );
    return jsonOk(request, confirmation, 201);
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("POST /api/public/agents/[publicKey]/confirmations", error);
    return jsonError(request, 500, "Unable to create confirmation");
  }
}
