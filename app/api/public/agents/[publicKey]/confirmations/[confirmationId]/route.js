import { getPublicAgentByKey } from "@/lib/services/embed.service";
import {
  approveConfirmation,
  denyConfirmation,
} from "@/lib/services/confirmation.service";
import prisma from "@/lib/prisma";
import { originFromRequest } from "@/lib/utils/request-origin";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pubConfirmLimitOpts } from "@/lib/rate-limit-config";

/**
 * F14-A/B/E — Public approve (default) or deny + stamp evidence.
 * Body: `{ conversationId, decision?, userSubject?, userDisplay? }`
 */
export async function POST(request, { params }) {
  try {
    const { publicKey, confirmationId } = await params;
    const ip = clientIp(request);
    const limited = rateLimit(
      `pub-confirm-approve:${publicKey}:${ip}`,
      pubConfirmLimitOpts()
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

    const body = await request.json().catch(() => ({}));
    const conversationId = String(body?.conversationId || "").trim();
    if (!conversationId) {
      return jsonError(request, 400, "Validation failed", {
        conversationId: "conversationId is required",
      });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, agentId: true, customerSubject: true },
    });
    if (!conversation || conversation.agentId !== agent.id) {
      return jsonError(request, 404, "Conversation not found");
    }

    const decision =
      String(body?.decision || "approve").toLowerCase() === "deny"
        ? "deny"
        : "approve";

    const evidence = {
      userSubject: body?.userSubject || conversation.customerSubject,
      userDisplay: body?.userDisplay,
      clientIp: ip,
    };

    const confirmation =
      decision === "deny"
        ? await denyConfirmation(confirmationId, conversation.id, evidence)
        : await approveConfirmation(confirmationId, conversation.id, evidence);

    return jsonOk(request, confirmation, 200);
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error(
      "POST /api/public/agents/[publicKey]/confirmations/[confirmationId]",
      error
    );
    return jsonError(request, 500, "Unable to resolve confirmation");
  }
}
