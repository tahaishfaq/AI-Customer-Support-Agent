import { getAppBaseUrl } from "@/lib/billing/app-url";
import { EMAIL_TEMPLATES } from "@/lib/email/constants";
import { sendEmail } from "@/lib/email/send";
import prisma from "@/lib/prisma";

function dayKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function priceLine(plan) {
  if (!plan) return null;
  if (plan.planType === "FREE" || !plan.priceMinor) return "Basic — free";
  // priceMinor is whole PKR (e.g. 3500 = Rs 3,500), not paisa.
  const amount = Number(plan.priceMinor).toLocaleString("en-PK");
  const currency = (plan.currency || "PKR").toUpperCase();
  const interval = String(plan.interval || "MONTH").toLowerCase();
  return `${currency} ${amount} / ${interval}`;
}

async function loadUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
}

async function safeSend(opts) {
  try {
    return await sendEmail(opts);
  } catch (error) {
    console.error("[email] billing notify failed", {
      template: opts.template,
      code: error.code || error.message,
    });
    return { ok: false, error };
  }
}

export async function notifyPlanSubscribed({
  userId,
  subscriptionId,
  plan,
  kind = "subscribe",
}) {
  const user = await loadUser(userId);
  if (!user?.email) return { ok: false, reason: "no_user" };
  const base = getAppBaseUrl();
  const template =
    kind === "change"
      ? EMAIL_TEMPLATES.PLAN_CHANGED
      : EMAIL_TEMPLATES.PLAN_SUBSCRIBED;
  const key =
    kind === "change"
      ? `plan_changed:${subscriptionId}:${plan?.id || "plan"}:${dayKey()}`
      : `plan_subscribed:${subscriptionId}:${plan?.id || "plan"}`;

  return safeSend({
    template,
    to: user.email,
    userId: user.id,
    idempotencyKey: key,
    tags: ["billing", kind],
    data: {
      name: user.name,
      planName: plan?.name || "AIDE",
      priceLine: priceLine(plan),
      dashboardUrl: `${base}/auth/continue`,
      plansUrl: `${base}/billing/plans`,
      billingUrl: `${base}/settings/billing`,
    },
  });
}

export async function notifyPaymentReceipt({
  userId,
  subscriptionId,
  plan,
  reference = null,
  periodEnd = null,
}) {
  const user = await loadUser(userId);
  if (!user?.email) return { ok: false, reason: "no_user" };
  const base = getAppBaseUrl();
  const stamp = periodEnd ? dayKey(periodEnd) : dayKey();
  return safeSend({
    template: EMAIL_TEMPLATES.PAYMENT_RECEIPT,
    to: user.email,
    userId: user.id,
    idempotencyKey: `payment_receipt:${subscriptionId}:${stamp}:${plan?.id || "plan"}`,
    tags: ["billing", "receipt"],
    data: {
      name: user.name,
      planName: plan?.name || "AIDE",
      priceLine: priceLine(plan),
      reference,
      billingUrl: `${base}/settings/billing`,
    },
  });
}

export async function notifyPlanRenewed({
  userId,
  subscriptionId,
  plan,
  periodEnd = null,
}) {
  const user = await loadUser(userId);
  if (!user?.email) return { ok: false, reason: "no_user" };
  const base = getAppBaseUrl();
  const stamp = periodEnd ? dayKey(periodEnd) : dayKey();
  return safeSend({
    template: EMAIL_TEMPLATES.PLAN_RENEWED,
    to: user.email,
    userId: user.id,
    idempotencyKey: `plan_renewed:${subscriptionId}:${stamp}`,
    tags: ["billing", "renew"],
    data: {
      name: user.name,
      planName: plan?.name || "AIDE",
      priceLine: priceLine(plan),
      billingUrl: `${base}/settings/billing`,
    },
  });
}

export async function notifySubscriptionPastDue({
  userId,
  subscriptionId,
  plan,
}) {
  const user = await loadUser(userId);
  if (!user?.email) return { ok: false, reason: "no_user" };
  const base = getAppBaseUrl();
  return safeSend({
    template: EMAIL_TEMPLATES.SUBSCRIPTION_PAST_DUE,
    to: user.email,
    userId: user.id,
    idempotencyKey: `subscription_past_due:${subscriptionId}:${dayKey()}`,
    tags: ["billing", "past_due"],
    data: {
      name: user.name,
      planName: plan?.name || "AIDE",
      billingUrl: `${base}/settings/billing`,
    },
  });
}

export async function notifyCancelScheduled({
  userId,
  subscriptionId,
  plan,
  periodEnd,
}) {
  const user = await loadUser(userId);
  if (!user?.email) return { ok: false, reason: "no_user" };
  const base = getAppBaseUrl();
  const end = periodEnd ? new Date(periodEnd) : null;
  const endLabel = end && !Number.isNaN(end.getTime())
    ? end.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "the end of your billing period";
  return safeSend({
    template: EMAIL_TEMPLATES.SUBSCRIPTION_CANCEL_SCHEDULED,
    to: user.email,
    userId: user.id,
    idempotencyKey: `cancel_scheduled:${subscriptionId}:${end ? dayKey(end) : "none"}`,
    tags: ["billing", "cancel"],
    data: {
      name: user.name,
      planName: plan?.name || "AIDE",
      periodEnd: endLabel,
      billingUrl: `${base}/settings/billing`,
    },
  });
}

export async function notifySubscriptionCanceled({
  userId,
  subscriptionId,
}) {
  const user = await loadUser(userId);
  if (!user?.email) return { ok: false, reason: "no_user" };
  const base = getAppBaseUrl();
  return safeSend({
    template: EMAIL_TEMPLATES.SUBSCRIPTION_CANCELED,
    to: user.email,
    userId: user.id,
    idempotencyKey: `canceled:${subscriptionId}:${dayKey()}`,
    tags: ["billing", "canceled"],
    data: {
      name: user.name,
      plansUrl: `${base}/billing/plans`,
    },
  });
}

export async function notifyRenewalUpcoming({
  userId,
  subscriptionId,
  plan,
  periodEnd,
}) {
  const user = await loadUser(userId);
  if (!user?.email) return { ok: false, reason: "no_user" };
  const base = getAppBaseUrl();
  const end = new Date(periodEnd);
  const endLabel = end.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return safeSend({
    template: EMAIL_TEMPLATES.PLAN_RENEWAL_UPCOMING,
    to: user.email,
    userId: user.id,
    idempotencyKey: `plan_renewal_upcoming:${subscriptionId}:${dayKey(end)}`,
    tags: ["billing", "renewal_upcoming"],
    data: {
      name: user.name,
      planName: plan?.name || "AIDE",
      renewDate: endLabel,
      priceLine: priceLine(plan),
      billingUrl: `${base}/settings/billing`,
    },
  });
}
