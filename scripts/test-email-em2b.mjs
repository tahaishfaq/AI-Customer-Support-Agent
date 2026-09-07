/**
 * EM2b — Subscribe / renew / cancel emails + idempotent retries.
 * Run: npm run test:email-em2b
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function main() {
  process.env.EMAIL_TEST_MODE = "1";

  const activate = read("lib/billing/activate-paid-subscription.js");
  assert(/notifyPlanSubscribed/.test(activate), "paid activate subscribe mail");
  assert(/notifyPlanRenewed/.test(activate), "paid renew mail");
  assert(/notifyPaymentReceipt/.test(activate), "receipt mail");

  const subSvc = read("lib/billing/subscription.service.js");
  assert(/emailFreePlanActivated|notifyPlanSubscribed/.test(subSvc), "free activate mail");
  assert(/notifyCancelScheduled/.test(subSvc), "cancel scheduled mail");

  const webhook = read("lib/billing/webhook.service.js");
  assert(/notifySubscriptionPastDue/.test(webhook), "past due mail");
  assert(/notifySubscriptionCanceled/.test(webhook), "canceled mail");

  const renew = read("lib/billing/renewal-reminders.js");
  assert(/cancelAtPeriodEnd:\s*false/.test(renew), "cron skips canceling");
  assert(/notifyRenewalUpcoming/.test(renew), "upcoming renew mail");

  if (!process.env.DATABASE_URL) {
    console.warn("skip EM2b DB gate (no DATABASE_URL)");
    console.log("ok email-em2b (static)");
    return;
  }

  const { clearEmailSink, drainEmailSink } = await import(
    "../lib/email/test-sink.js"
  );
  const {
    notifyPlanSubscribed,
    notifyCancelScheduled,
    notifySubscriptionCanceled,
    notifyPlanRenewed,
  } = await import("../lib/email/billing-notify.js");
  const { listRenewalRemindersDue } = await import(
    "../lib/billing/renewal-reminders.js"
  );
  const prisma = (await import("../lib/prisma.js")).default;

  const stamp = Date.now();
  const email = `em2b.${stamp}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "EM2b",
      email,
      passwordHash: await bcrypt.hash("Em2bPass123!", 10),
      role: "USER",
      status: "ACTIVE",
    },
  });

  const plan =
    (await prisma.billingPlan.findFirst({
      where: { planType: "FREE", isActive: true },
    })) ||
    (await prisma.billingPlan.create({
      data: {
        slug: `em2b-free-${stamp}`,
        name: "EM2b Free",
        planType: "FREE",
        priceMinor: 0,
        currency: "PKR",
        interval: "MONTH",
        isActive: true,
      },
    }));

  const paidPlan =
    (await prisma.billingPlan.findFirst({
      where: { planType: { not: "FREE" }, isActive: true },
    })) || plan;

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: paidPlan.id,
      status: "ACTIVE",
      activatedAt: new Date(),
      currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
  });

  try {
    clearEmailSink();
    const first = await notifyPlanSubscribed({
      userId: user.id,
      subscriptionId: subscription.id,
      plan: paidPlan,
      kind: "subscribe",
    });
    assert(first.ok, "subscribe mail sent");
    const second = await notifyPlanSubscribed({
      userId: user.id,
      subscriptionId: subscription.id,
      plan: paidPlan,
      kind: "subscribe",
    });
    assert(second.skipped === true, "subscribe retry skipped");

    const renew1 = await notifyPlanRenewed({
      userId: user.id,
      subscriptionId: subscription.id,
      plan: paidPlan,
      periodEnd: subscription.currentPeriodEnd,
    });
    assert(renew1.ok, "renewed mail");
    const renew2 = await notifyPlanRenewed({
      userId: user.id,
      subscriptionId: subscription.id,
      plan: paidPlan,
      periodEnd: subscription.currentPeriodEnd,
    });
    assert(renew2.skipped === true, "renewed retry skipped");

    const cancel1 = await notifyCancelScheduled({
      userId: user.id,
      subscriptionId: subscription.id,
      plan: paidPlan,
      periodEnd: subscription.currentPeriodEnd,
    });
    assert(cancel1.ok, "cancel scheduled");
    const cancel2 = await notifyCancelScheduled({
      userId: user.id,
      subscriptionId: subscription.id,
      plan: paidPlan,
      periodEnd: subscription.currentPeriodEnd,
    });
    assert(cancel2.skipped === true, "cancel scheduled retry skipped");

    const ended1 = await notifySubscriptionCanceled({
      userId: user.id,
      subscriptionId: subscription.id,
    });
    assert(ended1.ok, "canceled mail");
    const ended2 = await notifySubscriptionCanceled({
      userId: user.id,
      subscriptionId: subscription.id,
    });
    assert(ended2.skipped === true, "canceled retry skipped");

    const dry = await listRenewalRemindersDue({ dryRun: true });
    assert(Array.isArray(dry.due), "cron dry-run lists due");
    assert(
      !dry.due.some((row) => row.cancelAtPeriodEnd === true),
      "dry-run never includes cancelAtPeriodEnd"
    );

    // Mark canceling — should not appear in due set after update
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true },
    });
    const dry2 = await listRenewalRemindersDue({ dryRun: true });
    assert(
      !dry2.due.some((row) => row.subscriptionId === subscription.id),
      "canceling sub skipped by cron"
    );

    const sunk = drainEmailSink();
    const templates = sunk.map((s) => s.template);
    assert(templates.includes("plan_subscribed"), "sink has subscribed");
    assert(templates.includes("plan_renewed"), "sink has renewed");
    assert(
      templates.includes("subscription_cancel_scheduled"),
      "sink has cancel scheduled"
    );
    assert(templates.includes("subscription_canceled"), "sink has canceled");
  } finally {
    await prisma.emailDeliveryLog.deleteMany({ where: { userId: user.id } });
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

  console.log("ok email-em2b");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
