import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/billing/app-url";
import { OPEN_SUBSCRIPTION_STATUSES } from "@/lib/billing/constants";
import {
  getOpenSubscription,
  subscriptionInclude,
} from "@/lib/billing/subscription.service";
import { getSafepayClient, isSafepayConfigured } from "@/lib/billing/safepay-client";
import { isPlanComingSoon, BASIC_PLAN_NAME } from "@/lib/billing/plan-labels";
import { writeAuditEvent } from "@/lib/services/audit.service";

const PAID_PLAN_TYPES = new Set(["POPULAR", "TEAMS"]);

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function isPaidPlanType(planType) {
  return PAID_PLAN_TYPES.has(planType);
}

export async function startPaidCheckout(userId, planId, { ip = null, appBaseUrl = null } = {}) {
  if (!isSafepayConfigured()) {
    throw httpError(
      503,
      "Paid checkout is not available yet. Choose Basic or contact support.",
      { code: "safepay_not_configured" }
    );
  }

  const plan = await prisma.billingPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive || !isPaidPlanType(plan.planType)) {
    throw httpError(400, "Invalid paid plan");
  }
  if (isPlanComingSoon(plan)) {
    throw httpError(
      503,
      `${plan.name} is coming soon. Choose Popular or ${BASIC_PLAN_NAME} for now.`,
      { code: "plan_coming_soon" }
    );
  }
  if (!plan.safepayPlanId?.trim()) {
    throw httpError(
      503,
      "This plan is not linked to SafePay yet. Ask an admin to set the SafePay plan id.",
      { code: "safepay_plan_missing" }
    );
  }

  const existing = await getOpenSubscription(userId);
  if (existing?.planId === planId && !existing.pendingPlanId) {
    throw httpError(409, "You are already on this plan", {
      code: "subscription_active",
    });
  }
  // If pendingPlanId matches, refresh checkout (new SafePay URL + reference) instead of blocking.

  const checkoutReference = crypto.randomUUID();
  const base = appBaseUrl || getAppBaseUrl();
  const cancelUrl = `${base}/billing/canceled?ref=${encodeURIComponent(checkoutReference)}`;
  const redirectUrl = `${base}/billing/success?ref=${encodeURIComponent(checkoutReference)}`;

  const subscription = await prisma.$transaction(async (tx) => {
    const open = await tx.subscription.findFirst({
      where: {
        userId,
        status: { in: OPEN_SUBSCRIPTION_STATUSES },
      },
      include: subscriptionInclude,
    });

    if (open?.status === "ACTIVE") {
      if (open.planId === planId) {
        throw httpError(409, "You are already on this plan", {
          code: "subscription_active",
        });
      }
      const canChangePlan =
        isPaidPlanType(open.plan?.planType) || open.plan?.planType === "FREE";
      if (!canChangePlan) {
        throw httpError(
          409,
          "Manage plan changes in Settings → Billing or contact support.",
          { code: "subscription_active" }
        );
      }

      return tx.subscription.update({
        where: { id: open.id },
        data: {
          pendingPlanId: plan.id,
          checkoutReference,
          cancelAtPeriodEnd: false,
        },
        include: subscriptionInclude,
      });
    }

    if (open?.status === "PENDING") {
      return tx.subscription.update({
        where: { id: open.id },
        data: {
          planId: plan.id,
          pendingPlanId: null,
          checkoutReference,
          status: "PENDING",
        },
        include: subscriptionInclude,
      });
    }

    if (open?.status === "PAST_DUE") {
      return tx.subscription.update({
        where: { id: open.id },
        data: {
          pendingPlanId: plan.id,
          checkoutReference,
          status: "PAST_DUE",
        },
        include: subscriptionInclude,
      });
    }

    return tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: "PENDING",
        checkoutReference,
      },
      include: subscriptionInclude,
    });
  });

  const safepay = getSafepayClient();
  const url = await safepay.checkout.createSubscription({
    planId: plan.safepayPlanId.trim(),
    reference: checkoutReference,
    cancelUrl,
    redirectUrl,
  });

  // Attach stored SafePay customer ref onto the open subscription when present.
  const onboarding = await prisma.userOnboarding.findUnique({
    where: { userId },
    select: { safepayCustomerRef: true },
  });
  if (onboarding?.safepayCustomerRef) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { safepayCustomerRef: onboarding.safepayCustomerRef },
    });
  }

  if (typeof url !== "string" || !url.startsWith("http")) {
    console.error("[billing] SafePay checkout failed", url);
    throw httpError(502, "Unable to start checkout with payment provider");
  }

  await writeAuditEvent({
    adminId: userId,
    action: "BILLING_CHECKOUT_STARTED",
    targetType: "subscription",
    targetId: subscription.id,
    metadata: {
      planId: plan.id,
      planType: plan.planType,
      checkoutReference,
      pendingPlanId: subscription.pendingPlanId || null,
    },
    ip,
  });

  return { url, checkoutReference, subscriptionId: subscription.id };
}

export async function getCheckoutReferenceForUser(userId, reference) {
  if (!reference) return null;
  return prisma.subscription.findFirst({
    where: {
      userId,
      checkoutReference: reference,
    },
    include: subscriptionInclude,
  });
}
