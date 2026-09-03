import prisma from "@/lib/prisma";
import { normalizeCheckoutReference } from "@/lib/billing/checkout-reference";
import { activatePaidSubscription } from "@/lib/billing/activate-paid-subscription";
import {
  fetchSafepaySubscriptionByReference,
  fetchSafepaySubscriptionByToken,
  safepaySubscriptionLooksPaid,
} from "@/lib/billing/safepay-subscription-api";
import { isSafepayConfigured } from "@/lib/billing/safepay-client";
import { subscriptionInclude } from "@/lib/billing/subscription.service";
import { subscriptionAwaitingCheckoutActivation } from "@/lib/billing/checkout-activation-rules";

const REDIRECT_RECONCILE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function sandboxRedirectReconcileEnabled() {
  return (
    process.env.SAFEPAY_ENVIRONMENT === "sandbox" &&
    (process.env.NODE_ENV === "development" ||
      process.env.BILLING_RECONCILE_ON_REDIRECT === "true")
  );
}

function parsePeriodEnd(record) {
  const raw =
    record?.current_period_end ||
    record?.currentPeriodEnd ||
    record?.period_end ||
    null;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractSubscriptionToken(record) {
  if (!record || typeof record !== "object") return null;
  return (
    record.token ||
    record.id ||
    record.subscription_id ||
    record.subscriptionId ||
    null
  );
}

async function loadCheckoutSubscription(userId, reference) {
  const normalized = normalizeCheckoutReference(reference);
  if (!normalized) {
    throw httpError(400, "Invalid checkout reference");
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      checkoutReference: normalized,
    },
    include: subscriptionInclude,
  });

  if (!subscription) {
    throw httpError(404, "Checkout not found for this account");
  }

  return subscription;
}

async function tryActivateFromSafepayRecord(
  subscription,
  record,
  { ip, source }
) {
  if (!safepaySubscriptionLooksPaid(record)) {
    return { activated: false, reason: "provider_not_paid" };
  }

  const token = extractSubscriptionToken(record);
  const periodEnd = parsePeriodEnd(record);

  await activatePaidSubscription(subscription, {
    subscriptionToken: token || subscription.safepaySubscriptionToken,
    periodEnd,
    eventType: "reconcile",
    source,
    ip,
  });

  return { activated: true, status: "ACTIVE" };
}

/**
 * After SafePay redirect, verify payment with the provider (fallback when webhooks
 * cannot reach localhost) and activate the subscription when paid.
 */
export async function reconcileCheckoutPayment(
  userId,
  reference,
  { subscriptionToken = null, ip = null } = {}
) {
  const subscription = await loadCheckoutSubscription(userId, reference);

  if (
    subscription.status === "ACTIVE" &&
    !subscription.pendingPlanId
  ) {
    return {
      activated: false,
      status: "ACTIVE",
      reason: "already_active",
    };
  }

  if (!subscriptionAwaitingCheckoutActivation(subscription)) {
    return {
      activated: false,
      status: subscription.status,
      reason: "not_awaiting_payment",
    };
  }

  if (isSafepayConfigured()) {
    const tokenCandidates = [
      subscriptionToken,
      subscription.safepaySubscriptionToken,
    ].filter(Boolean);

    for (const token of tokenCandidates) {
      try {
        const record = await fetchSafepaySubscriptionByToken(token);
        if (record) {
          const result = await tryActivateFromSafepayRecord(subscription, record, {
            ip,
            source: "safepay_token_lookup",
          });
          if (result.activated) return result;
        }
      } catch (error) {
        console.error(
          "[billing] reconcile token lookup failed",
          error?.message || error
        );
      }
    }

    try {
      const record = await fetchSafepaySubscriptionByReference(
        subscription.checkoutReference
      );
      if (record) {
        const result = await tryActivateFromSafepayRecord(subscription, record, {
          ip,
          source: "safepay_reference_lookup",
        });
        if (result.activated) return result;
      }
    } catch (error) {
      console.error(
        "[billing] reconcile reference lookup failed",
        error?.message || error
      );
    }
  }

  if (sandboxRedirectReconcileEnabled()) {
    const ageMs = Date.now() - new Date(subscription.updatedAt).getTime();
    if (ageMs <= REDIRECT_RECONCILE_MAX_AGE_MS) {
      await activatePaidSubscription(subscription, {
        subscriptionToken:
          subscriptionToken || subscription.safepaySubscriptionToken,
        eventType: "redirect_reconcile",
        source: "sandbox_redirect",
        ip,
      });
      return {
        activated: true,
        status: "ACTIVE",
        reason: "sandbox_redirect",
        planApplied: true,
      };
    }
  }

  return {
    activated: false,
    status: subscription.status,
    reason: "awaiting_webhook",
  };
}

/** Reconcile the user's most recent open checkout (upgrade or first paid). */
export async function reconcileLatestCheckout(userId, { ip = null } = {}) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      checkoutReference: { not: null },
      OR: [
        { status: { in: ["PENDING", "PAST_DUE"] } },
        {
          status: "ACTIVE",
          pendingPlanId: { not: null },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: subscriptionInclude,
  });

  if (!subscription?.checkoutReference) {
    return { activated: false, reason: "no_open_checkout" };
  }

  return reconcileCheckoutPayment(userId, subscription.checkoutReference, { ip });
}
