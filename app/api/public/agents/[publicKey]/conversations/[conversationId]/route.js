import { getPublicAgentByKey } from "@/lib/services/embed.service";
import prisma from "@/lib/prisma";
import { originFromRequest } from "@/lib/utils/request-origin";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";

export async function GET(request, { params }) {
  const requestId = resolveRequestId(request);

  try {
    const { publicKey, conversationId } = await params;
    const agent = await getPublicAgentByKey(publicKey, {
      origin: originFromRequest(request),
    });
    if (!agent) {
      return jsonError(request, 404, "Agent not found");
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            responseTime: true,
            feedback: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation || conversation.agentId !== agent.id) {
      return jsonError(request, 404, "Conversation not found");
    }

    return jsonOk(request, {
      id: conversation.id,
      messages: conversation.messages,
    });
  } catch {
    safeLogError("GET public conversation", {
      requestId,
      route: "public-conversation",
      status: 500,
    });
    return jsonError(request, 500, "Unable to load conversation");
  }
}
