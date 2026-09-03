import prisma from "@/lib/prisma";
import { BASIC_PLAN_NAME } from "@/lib/billing/plan-labels";
import {
  OPEN_SUBSCRIPTION_STATUSES,
  PRODUCT_UNLOCK_STATUSES,
} from "@/lib/billing/constants";
import { seedBillingPlans } from "@/lib/billing/plans.service";

function mapSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    pendingPlanId: row.pendingPlanId,
    status: row.status,
    activatedAt: row.activatedAt,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    checkoutReference: row.checkoutReference,
    plan: row.plan
      ? {
          id: row.plan.id,
          slug: row.plan.slug,
          name: row.plan.name,
          planType: row.plan.planType,
          priceMinor: row.plan.priceMinor,
          currency: row.plan.currency,
          maxWorkspaces: row.plan.maxWorkspaces,
          maxAgentsPerWorkspace: row.plan.maxAgentsPerWorkspace,
          maxConversationsPerMonth: row.plan.maxConversationsPerMonth,
        }
      : null,
    pendingPlan: row.pendingPlan
      ? {
          id: row.pendingPlan.id,
          slug: row.pendingPlan.slug,
          name: row.pendingPlan.name,
          planType: row.pendingPlan.planType,
        }
      : null,
  };
}

export const subscriptionInclude = {
  plan: {
    select: {
      id: true,
      slug: true,
      name: true,
      planType: true,
      priceMinor: true,
      currency: true,
      maxWorkspaces: true,
      maxAgentsPerWorkspace: true,
      maxConversationsPerMonth: true,
    },
  },
  pendingPlan: {
    select: {
      id: true,
      slug: true,
      name: true,
      planType: true,
    },
  },
};

export function subscriptionUnlocksProduct(status) {
  return PRODUCT_UNLOCK_STATUSES.includes(status);
}

export async function getOpenSubscription(userId) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: OPEN_SUBSCRIPTION_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: subscriptionInclude,
  });
}

export async function ensureGrandfatherFreeSubscription(userId) {
  const existing = await getOpenSubscription(userId);
  if (existing) return mapSubscription(existing);

  await seedBillingPlans();
  const freePlan = await prisma.billingPlan.findFirst({
    where: { planType: "FREE", isActive: true },
    select: { id: true },
  });
  if (!freePlan) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, createdAt: true },
  });
  if (!user || user.role !== "USER") return null;

  // Existing accounts (pre-B1) get Free ACTIVE once; new signups pick a plan.
  const billingLaunch = new Date("2026-09-01T00:00:00.000Z");
  if (user.createdAt >= billingLaunch) return null;

  try {
    const created = await prisma.subscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: "ACTIVE",
        activatedAt: new Date(),
      },
      include: subscriptionInclude,
    });
    return mapSubscription(created);
  } catch {
    const again = await getOpenSubscription(userId);
    return mapSubscription(again);
  }
}

export async function getBillingSnapshot(userId, role) {
  if (role === "ADMIN") {
    return {
      unlocked: true,
      status: null,
      planSlug: null,
      subscription: null,
      entitlements: null,
    };
  }

  let subscription = await getOpenSubscription(userId);
  if (!subscription) {
    const grandfathered = await ensureGrandfatherFreeSubscription(userId);
    if (grandfathered) {
      subscription = await getOpenSubscription(userId);
    }
  }

  const mapped = mapSubscription(subscription);
  const unlocked = mapped ? subscriptionUnlocksProduct(mapped.status) : false;

  return {
    unlocked,
    status: mapped?.status || null,
    planSlug: mapped?.plan?.slug || null,
    subscription: mapped,
    entitlements: mapped?.plan
      ? {
          maxWorkspaces: mapped.plan.maxWorkspaces,
          maxAgentsPerWorkspace: mapped.plan.maxAgentsPerWorkspace,
          maxConversationsPerMonth: mapped.plan.maxConversationsPerMonth,
          planType: mapped.plan.planType,
          planSlug: mapped.plan.slug,
          status: mapped.status,
        }
      : null,
  };
}

export async function activateFreePlan(userId, planId) {
  const plan = await prisma.billingPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive || plan.planType !== "FREE" || plan.safepayPlanId) {
    const err = new Error("Invalid Basic plan");
    err.status = 400;
    throw err;
  }

  const existing = await getOpenSubscription(userId);
  if (existing?.status === "ACTIVE" && existing.planId === planId) {
    return mapSubscription(existing);
  }

  // Incomplete SafePay checkout — choosing Basic abandons it and unlocks the app.
  if (existing?.status === "PENDING" && !existing.pendingPlanId) {
    const updated = await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        pendingPlanId: null,
        checkoutReference: null,
        safepaySubscriptionToken: null,
        status: "ACTIVE",
        activatedAt: new Date(),
      },
      include: subscriptionInclude,
    });
    return mapSubscription(updated);
  }

  if (existing?.status === "PENDING" && existing.pendingPlanId) {
    const err = new Error("Finish or cancel your pending checkout first");
    err.status = 409;
    throw err;
  }

  if (
    existing?.status === "ACTIVE" &&
    existing.plan?.planType &&
    existing.plan.planType !== "FREE"
  ) {
    const token = existing.safepaySubscriptionToken;
    if (token) {
      const { getSafepayClient, isSafepayConfigured } = await import(
        "@/lib/billing/safepay-client"
      );
      if (isSafepayConfigured()) {
        try {
          await getSafepayClient().subscription.cancel(token);
        } catch (error) {
          console.error("[billing] SafePay cancel before free switch", error?.message || error);
          const err = new Error("Unable to cancel paid subscription. Try Settings → Billing.");
          err.status = 502;
          throw err;
        }
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        pendingPlanId: null,
        checkoutReference: null,
        status: "ACTIVE",
        activatedAt: existing.activatedAt || new Date(),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        safepaySubscriptionToken: null,
      },
      include: subscriptionInclude,
    });
    return mapSubscription(updated);
  }

  const created = await prisma.$transaction(async (tx) => {
    const open = await tx.subscription.findFirst({
      where: {
        userId,
        status: { in: OPEN_SUBSCRIPTION_STATUSES },
      },
    });
    if (open?.status === "ACTIVE") return open;
    if (open?.status === "PENDING" && !open.pendingPlanId) {
      return tx.subscription.update({
        where: { id: open.id },
        data: {
          planId: plan.id,
          pendingPlanId: null,
          checkoutReference: null,
          safepaySubscriptionToken: null,
          status: "ACTIVE",
          activatedAt: new Date(),
        },
        include: subscriptionInclude,
      });
    }
    if (open?.status === "PENDING" && open.pendingPlanId) {
      const err = new Error("Finish or cancel your pending checkout first");
      err.status = 409;
      throw err;
    }

    if (open) {
      return tx.subscription.update({
        where: { id: open.id },
        data: {
          planId: plan.id,
          pendingPlanId: null,
          checkoutReference: null,
          status: "ACTIVE",
          activatedAt: new Date(),
        },
        include: subscriptionInclude,
      });
    }

    return tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: "ACTIVE",
        activatedAt: new Date(),
      },
      include: subscriptionInclude,
    });
  });

  return mapSubscription(created);
}

const PENDING_CHECKOUT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** B5 — expire abandoned checkouts (call from cron or admin script). */
export async function expireStalePendingCheckouts({
  maxAgeMs = PENDING_CHECKOUT_MAX_AGE_MS,
} = {}) {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const stalePurePending = await prisma.subscription.updateMany({
    where: {
      status: "PENDING",
      pendingPlanId: null,
      createdAt: { lt: cutoff },
    },
    data: { status: "EXPIRED" },
  });

  const clearedPendingUpgrades = await prisma.subscription.updateMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE"] },
      pendingPlanId: { not: null },
      updatedAt: { lt: cutoff },
    },
    data: {
      pendingPlanId: null,
      checkoutReference: null,
    },
  });

  return {
    expiredPending: stalePurePending.count,
    clearedPendingUpgrades: clearedPendingUpgrades.count,
  };
}

export async function cancelUserSubscription(userId, { ip = null } = {}) {
  const subscription = await getOpenSubscription(userId);
  if (!subscription || subscription.status !== "ACTIVE") {
    const err = new Error("No active subscription to cancel");
    err.status = 400;
    throw err;
  }

  if (subscription.plan?.planType === "FREE") {
    const err = new Error(`${BASIC_PLAN_NAME} plan does not require cancellation`);
    err.status = 400;
    throw err;
  }

  if (subscription.cancelAtPeriodEnd) {
    const err = new Error("Cancellation is already scheduled");
    err.status = 400;
    throw err;
  }

  const token = subscription.safepaySubscriptionToken;
  if (token) {
    const { getSafepayClient, isSafepayConfigured } = await import(
      "@/lib/billing/safepay-client"
    );
    if (isSafepayConfigured()) {
      try {
        await getSafepayClient().subscription.cancel(token);
      } catch (error) {
        console.error("[billing] SafePay cancel failed", error?.message || error);
        const err = new Error("Unable to cancel with payment provider");
        err.status = 502;
        throw err;
      }
    }
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
    },
    include: subscriptionInclude,
  });

  const { writeAuditEvent } = await import("@/lib/services/audit.service");
  await writeAuditEvent({
    adminId: userId,
    action: "BILLING_CANCEL_REQUESTED",
    targetType: "subscription",
    targetId: subscription.id,
    metadata: { planId: subscription.planId },
    ip,
  });

  return mapSubscription(updated);
}
