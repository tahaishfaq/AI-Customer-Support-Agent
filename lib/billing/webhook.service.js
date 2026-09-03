import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { normalizeCheckoutReference } from "@/lib/billing/checkout-reference";
import { activatePaidSubscription } from "@/lib/billing/activate-paid-subscription";
import { getSafepayClient } from "@/lib/billing/safepay-client";
import { writeAuditEvent } from "@/lib/services/audit.service";

const PAID_ACTIVE_EVENTS = new Set([
  "subscription_payment:complete",
  "subscription_payment.complete",
]);

function redactPayload(body) {
  if (!body || typeof body !== "object") return null;
  const data = body.data || body;
  return {
    type: data.type || data.event || body.type || null,
    id: data.id || body.id || null,
    reference:
      data.reference ||
      data.subscription?.reference ||
      data.metadata?.reference ||
      null,
    subscriptionId:
      data.subscription?.token ||
      data.subscription?.id ||
      data.subscription_id ||
      null,
  };
}

function extractEventMeta(body) {
  const data = body?.data && typeof body.data === "object" ? body.data : body;
  const eventType =
    data?.type || data?.event || body?.type || body?.event || "unknown";
  const externalId =
    data?.id ||
    body?.id ||
    data?.event_id ||
    crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const reference =
    data?.reference ||
    data?.subscription?.reference ||
    data?.metadata?.reference ||
    data?.checkout_reference ||
    null;
  const normalizedReference = normalizeCheckoutReference(reference);
  const subscriptionToken =
    data?.subscription?.token ||
    data?.subscription?.id ||
    data?.subscription_id ||
    data?.token ||
    null;
  const periodEndRaw =
    data?.current_period_end ||
    data?.subscription?.current_period_end ||
    data?.period_end ||
    null;

  return {
    eventType: String(eventType),
    externalId: String(externalId),
    reference: normalizedReference ? String(normalizedReference) : null,
    subscriptionToken: subscriptionToken ? String(subscriptionToken) : null,
    periodEnd: periodEndRaw ? new Date(periodEndRaw) : null,
  };
}

export async function processSafepayWebhook({ rawBody, headers, ip = null }) {
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    const err = new Error("Invalid JSON body");
    err.status = 400;
    throw err;
  }

  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const meta = extractEventMeta(body);

  let signatureValid = false;
  try {
    const safepay = getSafepayClient();
    signatureValid = Boolean(
      safepay.verify.webhook({
        body,
        headers: Object.fromEntries(
          Object.entries(headers || {}).map(([k, v]) => [
            k.toLowerCase(),
            Array.isArray(v) ? v[0] : v,
          ])
        ),
      })
    );
  } catch (error) {
    console.error("[billing] webhook signature check error", error.message);
    signatureValid = false;
  }

  if (!signatureValid) {
    try {
      await prisma.billingEvent.create({
        data: {
          eventType: meta.eventType,
          externalId: `invalid-${meta.externalId}`,
          checkoutReference: meta.reference,
          signatureValid: false,
          processingStatus: "FAILED",
          errorMessage: "Invalid webhook signature",
          payloadHash,
          payloadRedacted: redactPayload(body),
        },
      });
    } catch {
      // duplicate invalid id — ignore
    }
    const err = new Error("Invalid webhook signature");
    err.status = 401;
    throw err;
  }

  let billingEvent;
  try {
    billingEvent = await prisma.billingEvent.create({
      data: {
        eventType: meta.eventType,
        externalId: meta.externalId,
        checkoutReference: meta.reference,
        signatureValid: true,
        processingStatus: "RECEIVED",
        payloadHash,
        payloadRedacted: redactPayload(body),
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return { duplicate: true, externalId: meta.externalId };
    }
    throw error;
  }

  try {
    const result = await applySafepayEvent(meta, { ip });
    await prisma.billingEvent.update({
      where: { id: billingEvent.id },
      data: {
        processingStatus: result.ignored ? "IGNORED" : "PROCESSED",
        processedAt: new Date(),
        userId: result.userId,
        subscriptionId: result.subscriptionId,
        errorMessage: result.errorMessage || null,
      },
    });
    return { duplicate: false, ...result };
  } catch (error) {
    await prisma.billingEvent.update({
      where: { id: billingEvent.id },
      data: {
        processingStatus: "FAILED",
        processedAt: new Date(),
        errorMessage: error.message?.slice(0, 500) || "Processing failed",
      },
    });
    throw error;
  }
}

async function applySafepayEvent(meta, { ip }) {
  const { eventType, reference, subscriptionToken, periodEnd } = meta;

  if (!reference) {
    return { ignored: true, reason: "no_reference" };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { checkoutReference: reference },
    include: { plan: true },
  });

  if (!subscription) {
    return { ignored: true, reason: "unknown_reference" };
  }

  const now = new Date();
  const baseUpdate = {
    lastWebhookAt: now,
    ...(subscriptionToken ? { safepaySubscriptionToken: subscriptionToken } : {}),
  };

  if (eventType === "subscription:created") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: baseUpdate,
    });
    return {
      ignored: false,
      userId: subscription.userId,
      subscriptionId: subscription.id,
      action: "token_recorded",
    };
  }

  if (PAID_ACTIVE_EVENTS.has(eventType)) {
    await activatePaidSubscription(subscription, {
      subscriptionToken,
      periodEnd,
      eventType,
      source: "webhook",
      ip,
    });
    return {
      ignored: false,
      userId: subscription.userId,
      subscriptionId: subscription.id,
      action: "activated",
    };
  }

  if (
    eventType === "subscription_payment:failed" ||
    eventType === "subscription_payment.failed"
  ) {
    if (subscription.status === "ACTIVE") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { ...baseUpdate, status: "PAST_DUE" },
      });
    }
    return {
      ignored: false,
      userId: subscription.userId,
      subscriptionId: subscription.id,
      action: "payment_failed",
    };
  }

  if (eventType === "subscription:unpaid") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { ...baseUpdate, status: "PAST_DUE" },
    });
    return {
      ignored: false,
      userId: subscription.userId,
      subscriptionId: subscription.id,
      action: "past_due",
    };
  }

  if (eventType === "subscription:ended") {
    const freePlan = await prisma.billingPlan.findFirst({
      where: { planType: "FREE", isActive: true },
      select: { id: true },
    });

    const revertToFree = Boolean(freePlan);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        ...baseUpdate,
        pendingPlanId: null,
        checkoutReference: null,
        safepaySubscriptionToken: null,
        cancelAtPeriodEnd: false,
        ...(revertToFree
          ? {
              planId: freePlan.id,
              status: "ACTIVE",
              activatedAt: subscription.activatedAt || now,
              canceledAt: null,
            }
          : {
              status: "CANCELED",
              canceledAt: now,
            }),
      },
    });
    await writeAuditEvent({
      adminId: subscription.userId,
      action: "BILLING_CANCELED",
      targetType: "subscription",
      targetId: subscription.id,
      metadata: { checkoutReference: reference, eventType },
      ip,
    });
    return {
      ignored: false,
      userId: subscription.userId,
      subscriptionId: subscription.id,
      action: "ended",
    };
  }

  return { ignored: true, reason: "unhandled_event", eventType };
}
