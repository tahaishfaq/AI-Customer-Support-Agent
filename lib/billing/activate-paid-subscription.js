import prisma from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/services/audit.service";

/**
 * Mark a subscription ACTIVE after verified payment (webhook or reconcile).
 */
export async function activatePaidSubscription(
  subscription,
  {
    subscriptionToken = null,
    periodEnd = null,
    eventType = "subscription_payment:complete",
    source = "webhook",
    ip = null,
  } = {}
) {
  const now = new Date();
  const activatedAt = subscription.activatedAt || now;
  const targetPlanId = subscription.pendingPlanId || subscription.planId;
  const targetPlanType =
    subscription.pendingPlan?.planType || subscription.plan?.planType;

  const data = {
    planId: targetPlanId,
    pendingPlanId: null,
    status: "ACTIVE",
    activatedAt,
    lastPaymentAt: now,
    lastWebhookAt: now,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    ...(subscriptionToken ? { safepaySubscriptionToken: subscriptionToken } : {}),
    ...(periodEnd && !Number.isNaN(periodEnd.getTime())
      ? { currentPeriodEnd: periodEnd }
      : {}),
  };

  await prisma.subscription.update({
    where: { id: subscription.id },
    data,
  });

  await writeAuditEvent({
    adminId: subscription.userId,
    action: "BILLING_ACTIVATED",
    targetType: "subscription",
    targetId: subscription.id,
    metadata: {
      planId: targetPlanId,
      planType: targetPlanType,
      checkoutReference: subscription.checkoutReference,
      eventType,
      source,
    },
    ip,
  });

  return { activated: true, subscriptionId: subscription.id };
}
