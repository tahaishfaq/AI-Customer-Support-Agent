import crypto from "node:crypto";
import axios from "axios";
import prisma from "@/lib/prisma";
import { OPEN_SUBSCRIPTION_STATUSES } from "@/lib/billing/constants";
import { isPlanComingSoon } from "@/lib/billing/plan-labels";
import { getSafepayClient, isSafepayConfigured } from "@/lib/billing/safepay-client";
import { createSafepayCustomer } from "@/lib/billing/safepay-customer";
import { subscriptionInclude } from "@/lib/billing/subscription.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { planPriceToSafepayAmount } from "@/lib/billing/safepay-amount";

const PAID_PLAN_TYPES = new Set(["POPULAR", "TEAMS"]);

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function safepayHost() {
  const env = process.env.SAFEPAY_ENVIRONMENT?.trim() || "sandbox";
  if (env === "production") return "https://api.getsafepay.com";
  if (env === "development") return "https://dev.api.getsafepay.com";
  return "https://sandbox.api.getsafepay.com";
}

function merchantHeaders() {
  const secret = process.env.SAFEPAY_V1_SECRET.trim();
  return {
    "Content-Type": "application/json",
    "X-SFPY-MERCHANT-SECRET": secret,
    Authorization: `Bearer ${secret}`,
  };
}

/** Race-safe ensure: only create if missing; tolerate parallel creates via re-read. */
export async function ensureSafepayCustomerForPayment(userId, { userEmail, userName } = {}) {
  if (!isSafepayConfigured()) {
    throw httpError(503, "SafePay is not configured", {
      code: "safepay_not_configured",
    });
  }

  const onboarding = await prisma.userOnboarding.findUnique({
    where: { userId },
  });
  if (onboarding?.safepayCustomerRef) {
    return { token: onboarding.safepayCustomerRef, reused: true };
  }

  const user =
    userEmail && userName
      ? { email: userEmail, name: userName }
      : await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });

  const parts = String(user?.name || "Customer User").trim().split(/\s+/);
  const firstName = (onboarding?.firstName || parts[0] || "Customer").slice(0, 40);
  const lastName = (
    onboarding?.lastName || parts.slice(1).join(" ") || "User"
  ).slice(0, 40);

  const created = await createSafepayCustomer({
    firstName: firstName.length >= 2 ? firstName : "Customer",
    lastName: lastName.length >= 2 ? lastName : "User",
    email: user?.email,
    phone: onboarding?.phone || "+923001234567",
    country: onboarding?.country || "PK",
  });

  if (!created?.token) {
    throw httpError(502, "SafePay customer create failed", {
      code: "safepay_customer_failed",
    });
  }

  if (onboarding) {
    const updated = await prisma.userOnboarding.updateMany({
      where: { userId, safepayCustomerRef: null },
      data: {
        safepayCustomerRef: created.token,
        safepayCustomerStatus: "CREATED",
        safepayCustomerError: null,
      },
    });
    if (updated.count === 0) {
      const again = await prisma.userOnboarding.findUnique({
        where: { userId },
        select: { safepayCustomerRef: true },
      });
      if (again?.safepayCustomerRef) {
        return { token: again.safepayCustomerRef, reused: true };
      }
    }
  }

  return { token: created.token, reused: false };
}

function addBillingPeriod(from, interval) {
  const d = new Date(from);
  if (interval === "YEAR") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Create PaymentAttempt + Safepay tracker for Atoms checkout.
 */
export async function createAtomsPaymentSession(
  userId,
  planId,
  { userEmail, userName, ip = null } = {}
) {
  if (!isSafepayConfigured()) {
    throw httpError(503, "Paid checkout is not available yet", {
      code: "safepay_not_configured",
    });
  }

  const plan = await prisma.billingPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive || !PAID_PLAN_TYPES.has(plan.planType)) {
    throw httpError(400, "Invalid paid plan");
  }
  if (isPlanComingSoon(plan)) {
    throw httpError(503, `${plan.name} is coming soon`, {
      code: "plan_coming_soon",
    });
  }
  if (!plan.priceMinor || plan.priceMinor <= 0) {
    throw httpError(400, "Plan has no payable amount");
  }

  const { token: customerToken } = await ensureSafepayCustomerForPayment(userId, {
    userEmail,
    userName,
  });

  const checkoutReference = crypto.randomUUID();

  const subscription = await prisma.$transaction(async (tx) => {
    const open = await tx.subscription.findFirst({
      where: { userId, status: { in: OPEN_SUBSCRIPTION_STATUSES } },
      include: subscriptionInclude,
    });

    if (open?.status === "ACTIVE" && open.planId === planId && !open.pendingPlanId) {
      throw httpError(409, "You are already on this plan", {
        code: "subscription_active",
      });
    }

    if (open?.status === "ACTIVE") {
      return tx.subscription.update({
        where: { id: open.id },
        data: {
          pendingPlanId: plan.id,
          checkoutReference,
          billingMode: "ATOMS_HYBRID",
          safepayCustomerRef: customerToken,
          cancelAtPeriodEnd: false,
        },
        include: subscriptionInclude,
      });
    }

    if (open) {
      return tx.subscription.update({
        where: { id: open.id },
        data: {
          planId: plan.id,
          pendingPlanId: null,
          checkoutReference,
          status: open.status === "PAST_DUE" ? "PAST_DUE" : "PENDING",
          billingMode: "ATOMS_HYBRID",
          safepayCustomerRef: customerToken,
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
        billingMode: "ATOMS_HYBRID",
        safepayCustomerRef: customerToken,
      },
      include: subscriptionInclude,
    });
  });

  const attempt = await prisma.paymentAttempt.create({
    data: {
      userId,
      subscriptionId: subscription.id,
      planId: plan.id,
      checkoutReference,
      customerRef: customerToken,
      // Store whole PKR (same unit as BillingPlan.priceMinor).
      amount: plan.priceMinor,
      currency: plan.currency || "PKR",
      type: "INITIAL",
      status: "CREATED",
    },
  });

  const safepayAmount = planPriceToSafepayAmount(plan.priceMinor);

  const sessionRes = await axios.post(
    `${safepayHost()}/order/payments/v3/`,
    {
      amount: safepayAmount,
      currency: plan.currency || "PKR",
      customer: customerToken,
    },
    { headers: merchantHeaders(), validateStatus: () => true, timeout: 20000 }
  );

  const tracker = sessionRes.data?.data?.tracker;
  if (sessionRes.status >= 400 || !tracker?.token) {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "FAILED",
        failureCode: "session_create_failed",
        failureMessage: JSON.stringify(sessionRes.data?.status || {}).slice(0, 400),
      },
    });
    throw httpError(502, "Unable to start payment session", {
      code: "safepay_session_failed",
    });
  }

  const authToken = await getSafepayClient().authorization.create();

  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      trackerToken: tracker.token,
      status: "PROCESSING",
    },
  });

  await writeAuditEvent({
    adminId: userId,
    action: "BILLING_ATOMS_SESSION_CREATED",
    targetType: "payment_attempt",
    targetId: attempt.id,
    metadata: {
      planId: plan.id,
      checkoutReference,
      tracker: tracker.token,
    },
    ip,
  });

  return {
    attemptId: attempt.id,
    checkoutReference,
    subscriptionId: subscription.id,
    tracker: tracker.token,
    authToken,
    environment: process.env.SAFEPAY_ENVIRONMENT?.trim() || "sandbox",
    amount: plan.priceMinor,
    currency: plan.currency || "PKR",
    planName: plan.name,
    customerToken,
  };
}

/**
 * Confirm Atoms success for an owned attempt and activate subscription.
 * Prefer provider webhooks long-term; this path is gated to attempt ownership + age.
 */
export async function confirmAtomsPayment(
  userId,
  { attemptId, paymentMethod = null },
  { ip = null } = {}
) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt || attempt.userId !== userId) {
    throw httpError(404, "Payment attempt not found");
  }
  if (attempt.status === "SUCCEEDED") {
    const sub = await prisma.subscription.findUnique({
      where: { id: attempt.subscriptionId },
      include: subscriptionInclude,
    });
    return { already: true, subscription: sub, attempt };
  }
  if (!["CREATED", "PROCESSING"].includes(attempt.status)) {
    throw httpError(409, "Payment attempt is not confirmable", {
      code: "attempt_not_open",
    });
  }

  const ageMs = Date.now() - new Date(attempt.createdAt).getTime();
  if (ageMs > 2 * 60 * 60 * 1000) {
    throw httpError(410, "Payment attempt expired", { code: "attempt_expired" });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: attempt.subscriptionId },
    include: {
      plan: { select: { ...subscriptionInclude.plan.select, interval: true } },
      pendingPlan: {
        select: { ...subscriptionInclude.pendingPlan.select, interval: true },
      },
    },
  });
  if (!subscription || subscription.userId !== userId) {
    throw httpError(404, "Subscription not found");
  }

  const plan =
    (subscription.pendingPlanId ? subscription.pendingPlan : null) ||
    subscription.plan ||
    (await prisma.billingPlan.findUnique({ where: { id: attempt.planId } }));

  const now = new Date();
  const periodEnd = addBillingPeriod(now, plan?.interval || "MONTH");
  const instrument = paymentMethod || attempt.instrumentRef || null;

  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "SUCCEEDED",
      instrumentRef: instrument,
    },
  });

  const { activatePaidSubscription } = await import(
    "@/lib/billing/activate-paid-subscription"
  );

  await activatePaidSubscription(subscription, {
    periodStart: now,
    periodEnd,
    billingMode: "ATOMS_HYBRID",
    paymentMethodRef: instrument,
    customerRef: attempt.customerRef || subscription.safepayCustomerRef,
    eventType: "atoms_payment:complete",
    source: "atoms_confirm",
    ip,
    touchWebhookAt: false,
  });

  await writeAuditEvent({
    adminId: userId,
    action: "BILLING_ATOMS_CONFIRMED",
    targetType: "payment_attempt",
    targetId: attempt.id,
    metadata: {
      subscriptionId: subscription.id,
      paymentMethod: instrument,
      planId: attempt.planId,
    },
    ip,
  });

  const refreshed = await prisma.subscription.findUnique({
    where: { id: subscription.id },
    include: subscriptionInclude,
  });

  return { already: false, subscription: refreshed, attemptId: attempt.id };
}
