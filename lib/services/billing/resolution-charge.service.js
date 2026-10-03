/**
 * Level 3 · L5 — create / reverse ResolutionCharge rows (idempotent).
 */

import prisma from "@/lib/prisma";
import { safeLogError } from "@/lib/observability/safe-log";
import {
  CHARGE_STATUS,
  isChargeableResolution,
  monthUtcBounds,
  shouldReverseCharge,
} from "@/lib/billing/resolution-charge";

export async function maybeChargeSettledConversation(conversationId) {
  if (!conversationId) return null;
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        source: true,
        isSimulation: true,
        handoffCount: true,
        agentId: true,
        agent: {
          select: {
            userId: true,
            workspaceId: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { createdAt: true, feedback: true, answerState: true, role: true },
        },
      },
    });
    if (!conversation) return null;

    const last = conversation.messages[0];
    const lastAssistant = conversation.messages.find((m) => m.role === "ASSISTANT");
    const row = {
      source: conversation.source,
      isSimulation: conversation.isSimulation,
      handoffCount: conversation.handoffCount,
      negativeFeedback: lastAssistant?.feedback === "DOWN",
      lastAnswerState: lastAssistant?.answerState,
      lastMessageAt: last?.createdAt,
    };
    if (!isChargeableResolution(row)) return null;

    const subscription = await prisma.subscription.findFirst({
      where: { userId: conversation.agent.userId, status: "ACTIVE" },
      select: {
        plan: {
          select: {
            resolutionPricingEnabled: true,
            resolutionPriceMinor: true,
            maxResolutionsPerMonth: true,
            currency: true,
          },
        },
      },
    });
    const plan = subscription?.plan;
    if (!plan?.resolutionPricingEnabled || !plan.resolutionPriceMinor) return null;

    const { start, end } = monthUtcBounds();
    if (plan.maxResolutionsPerMonth > 0) {
      const used = await prisma.resolutionCharge.count({
        where: {
          userId: conversation.agent.userId,
          status: CHARGE_STATUS.CHARGED,
          chargedAt: { gte: start, lt: end },
        },
      });
      if (used >= plan.maxResolutionsPerMonth) return null;
    }

    return prisma.resolutionCharge.upsert({
      where: { conversationId },
      create: {
        conversationId,
        userId: conversation.agent.userId,
        workspaceId: conversation.agent.workspaceId,
        agentId: conversation.agentId,
        amountMinor: plan.resolutionPriceMinor,
        currency: plan.currency || "USD",
        status: CHARGE_STATUS.CHARGED,
      },
      update: {},
    });
  } catch (error) {
    safeLogError("maybeChargeSettledConversation failed", {
      code: error?.code || "charge_error",
    });
    return null;
  }
}

export async function reverseResolutionCharge(conversationId, reason) {
  if (!conversationId) return null;
  const existing = await prisma.resolutionCharge.findUnique({
    where: { conversationId },
  });
  if (!existing || existing.status !== CHARGE_STATUS.CHARGED) return null;
  if (!shouldReverseCharge({ chargedAt: existing.chargedAt, reason })) return null;
  return prisma.resolutionCharge.update({
    where: { conversationId },
    data: {
      status: CHARGE_STATUS.REVERSED,
      reversedAt: new Date(),
      reverseReason: String(reason || "").slice(0, 80),
    },
  });
}

export function scheduleResolutionCharge(conversationId) {
  if (!conversationId) return;
  const run = () => maybeChargeSettledConversation(conversationId);
  import("next/server")
    .then(({ after }) => {
      try {
        after(() => run());
      } catch {
        void run();
      }
    })
    .catch(() => {
      void run();
    });
}
