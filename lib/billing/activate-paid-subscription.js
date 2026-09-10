import prisma from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { enqueueRealtimeEvent } from "@/lib/realtime/outbox";
import { REALTIME_EVENT_TYPES, REALTIME_VISIBILITIES } from "@/lib/realtime/constants";
import {
  notifyPaymentReceipt,
  notifyPlanRenewed,
  notifyPlanSubscribed,
} from "@/lib/email/billing-notify";

/**
 * Mark a subscription ACTIVE after verified payment (webhook or reconcile).
 */
export async function activatePaidSubscription(
  subscription,
  {
    subscriptionToken = null,
    periodEnd = null,
    periodStart = null,
    billingMode = null,
    paymentMethodRef = null,
    customerRef = null,
    eventType = "subscription_payment:complete",
    source = "webhook",
    ip = null,
    touchWebhookAt = true,
  } = {}
) {
  const now = new Date();
  const activatedAt = subscription.activatedAt || now;
  const targetPlanId = subscription.pendingPlanId || subscription.planId;
  const previousStatus = subscription.status;
  const wasPlanChange = Boolean(subscription.pendingPlanId);
  const targetPlan = subscription.pendingPlan || subscription.plan || null;
  const targetPlanType = targetPlan?.planType;

  const data = {
    planId: targetPlanId,
    pendingPlanId: null,
    status: "ACTIVE",
    activatedAt,
    lastPaymentAt: now,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    ...(touchWebhookAt ? { lastWebhookAt: now } : {}),
    ...(subscriptionToken
      ? { safepaySubscriptionToken: subscriptionToken }
      : {}),
    ...(periodEnd && !Number.isNaN(periodEnd.getTime())
      ? { currentPeriodEnd: periodEnd }
      : {}),
    ...(periodStart && !Number.isNaN(periodStart.getTime())
      ? { currentPeriodStart: periodStart }
      : {}),
    ...(billingMode ? { billingMode } : {}),
    ...(paymentMethodRef
      ? { safepayPaymentMethodRef: paymentMethodRef }
      : {}),
    ...(customerRef ? { safepayCustomerRef: customerRef } : {}),
  };

  const updatedSubscription = await prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id: subscription.id },
      data: { ...data, realtimeVersion: { increment: 1 } },
      select: {
        id: true,
        userId: true,
        planId: true,
        status: true,
        currentPeriodEnd: true,
        realtimeVersion: true,
      },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.BILLING_SUBSCRIPTION_UPDATED,
      visibility: REALTIME_VISIBILITIES.OWNER,
      userId: updated.userId,
      aggregateType: "subscription",
      aggregateVersion: updated.realtimeVersion,
      payload: {
        subscriptionId: updated.id,
        status: updated.status,
        planId: updated.planId,
        currentPeriodEnd: updated.currentPeriodEnd,
        action: "activated",
        providerEventType: eventType,
      },
    });
    return updated;
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

  const plan =
    targetPlan ||
    (await prisma.billingPlan.findUnique({ where: { id: targetPlanId } }));

  const isRenewal = previousStatus === "ACTIVE" && !wasPlanChange;

  if (isRenewal) {
    await notifyPlanRenewed({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      plan,
      periodEnd: periodEnd || subscription.currentPeriodEnd,
    });
  } else if (wasPlanChange && previousStatus === "ACTIVE") {
    await notifyPlanSubscribed({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      plan,
      kind: "change",
    });
  } else {
    await notifyPlanSubscribed({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      plan,
      kind: "subscribe",
    });
  }

  if (plan?.planType && plan.planType !== "FREE") {
    await notifyPaymentReceipt({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      plan,
      reference: subscription.checkoutReference,
      periodEnd: periodEnd || now,
    });
  }

  return { activated: true, subscriptionId: updatedSubscription.id };
}
