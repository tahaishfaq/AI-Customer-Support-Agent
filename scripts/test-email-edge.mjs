/**
 * Email edge cases — duplication, enumeration, Google-only, cooldown, race.
 * Run: npm run test:email-edge
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
  process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC = "60";
  process.env.EMAIL_LOGIN_ALERTS = "0";
  process.env.EMAIL_ONBOARDING_DRIP = "1";

  // Static edge contracts
  const forgot = read("app/api/auth/forgot-password/route.js");
  assert(/jsonOk\(request, \{ ok: true \}\)/.test(forgot), "forgot always 200 shape");
  const resend = read("app/api/auth/resend-verify/route.js");
  assert(/resendVerifyEmail/.test(resend), "resend verify wired");
  const send = read("lib/email/send.js");
  assert(/P2002/.test(send), "concurrent idempotency race handled");

  if (!process.env.DATABASE_URL) {
    console.warn("skip email-edge DB (no DATABASE_URL)");
    console.log("ok email-edge (static)");
    return;
  }

  const { clearEmailSink, drainEmailSink } = await import(
    "../lib/email/test-sink.js"
  );
  const { sendEmail } = await import("../lib/email/send.js");
  const {
    requestPasswordResetOtp,
    resetPasswordWithOtp,
  } = await import("../lib/services/password-reset.service.js");
  const {
    resendVerifyEmail,
    sendOnboardingDay1Nudges,
    maybeSendLoginAlert,
  } = await import("../lib/services/email-lifecycle.service.js");
  const {
    notifyPlanSubscribed,
    notifyCancelScheduled,
  } = await import("../lib/email/billing-notify.js");
  const prisma = (await import("../lib/prisma.js")).default;

  const stamp = Date.now();
  const email = `edge.${stamp}@example.com`;
  const googleOnly = `edge.google.${stamp}@example.com`;

  const user = await prisma.user.create({
    data: {
      name: "Edge User",
      email,
      passwordHash: await bcrypt.hash("EdgePass123!", 10),
      role: "USER",
      status: "ACTIVE",
    },
  });
  const gUser = await prisma.user.create({
    data: {
      name: "Google Only",
      email: googleOnly,
      passwordHash: null,
      googleId: `gid-edge-${stamp}`,
      emailVerified: new Date(),
      role: "USER",
      status: "ACTIVE",
    },
  });

  const plan =
    (await prisma.billingPlan.findFirst({ where: { isActive: true } })) ||
    null;

  let subscription = null;
  if (plan) {
    subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: "ACTIVE",
        activatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      },
    });
  }

  try {
    // 1) Unknown email forgot — no mail
    clearEmailSink();
    const miss = await requestPasswordResetOtp("nobody-edge@example.com");
    assert(miss.ok === true, "missing email ok");
    assert(drainEmailSink().length === 0, "no mail for missing email");

    // 2) Google-only forgot — silent no mail
    clearEmailSink();
    await requestPasswordResetOtp(googleOnly);
    assert(drainEmailSink().length === 0, "google-only no reset mail");

    // 3) Cooldown — second forgot within window does not send
    process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC = "60";
    clearEmailSink();
    await requestPasswordResetOtp(email);
    const first = drainEmailSink();
    assert(first.length === 1, "first OTP sent");
    clearEmailSink();
    const cool = await requestPasswordResetOtp(email);
    assert(cool.cooldown === true || drainEmailSink().length === 0, "cooldown suppresses");

    // 4) Concurrent idempotent send
    process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC = "0";
    const key = `edge-race:${stamp}`;
    clearEmailSink();
    const [a, b] = await Promise.all([
      sendEmail({
        template: "landing_contact_ack",
        to: "race@example.com",
        data: { fullName: "Race" },
        idempotencyKey: key,
      }),
      sendEmail({
        template: "landing_contact_ack",
        to: "race@example.com",
        data: { fullName: "Race" },
        idempotencyKey: key,
      }),
    ]);
    assert(a.ok && b.ok, "both race calls ok");
    assert(
      Boolean(a.skipped) !== Boolean(b.skipped) || a.skipped || b.skipped || drainEmailSink().length === 1,
      "race yields single delivery"
    );
    const sunkRace = drainEmailSink();
    assert(sunkRace.length <= 1, `race sink <=1 got ${sunkRace.length}`);

    // 5) Billing duplicate cancel mail
    if (subscription) {
      clearEmailSink();
      await notifyCancelScheduled({
        userId: user.id,
        subscriptionId: subscription.id,
        plan,
        periodEnd: subscription.currentPeriodEnd,
      });
      await notifyCancelScheduled({
        userId: user.id,
        subscriptionId: subscription.id,
        plan,
        periodEnd: subscription.currentPeriodEnd,
      });
      assert(
        drainEmailSink().filter((s) => s.template === "subscription_cancel_scheduled")
          .length === 1,
        "one cancel-scheduled mail"
      );

      clearEmailSink();
      await notifyPlanSubscribed({
        userId: user.id,
        subscriptionId: subscription.id,
        plan,
        kind: "subscribe",
      });
      await notifyPlanSubscribed({
        userId: user.id,
        subscriptionId: subscription.id,
        plan,
        kind: "subscribe",
      });
      assert(
        drainEmailSink().filter((s) => s.template === "plan_subscribed").length === 1,
        "one subscribe mail"
      );
    }

    // 6) Resend verify for unknown — ok, no throw
    clearEmailSink();
    await resendVerifyEmail("ghost-edge@example.com");
    assert(drainEmailSink().length === 0, "ghost resend silent");

    // 7) Login alerts off
    clearEmailSink();
    const alert = await maybeSendLoginAlert(user);
    assert(alert.skipped === true, "login alert off by default");
    assert(drainEmailSink().length === 0, "no login alert mail");

    // 8) Day1 skips users with agents
    const ws = await prisma.workspace.create({
      data: {
        name: `Edge WS ${stamp}`,
        slug: `edge-ws-${stamp}`,
        userId: user.id,
      },
    });
    await prisma.agent.create({
      data: {
        name: "Edge Agent",
        userId: user.id,
        workspaceId: ws.id,
        systemPrompt: "You are a test agent.",
        welcomeMessage: "Hi",
      },
    });
    const day1 = await sendOnboardingDay1Nudges({
      now: new Date(Date.now()),
      dryRun: true,
    });
    assert(
      !day1.due.some((d) => d.userId === user.id),
      "day1 skips users with agents"
    );

    // 9) Fresh OTP → reset → reuse rejected
    process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC = "0";
    const { createEmailToken, hashEmailToken } = await import(
      "../lib/email/tokens.js"
    );
    const { EMAIL_TOKEN_TYPES } = await import("../lib/email/constants.js");
    const { raw: otpRaw } = await createEmailToken({
      userId: user.id,
      type: EMAIL_TOKEN_TYPES.PASSWORD_RESET_OTP,
      ttlSec: 300,
    });
    assert(/^\d{6}$/.test(otpRaw), "otp code present");
    assert(hashEmailToken(otpRaw).length === 64, "otp hashed");
    await resetPasswordWithOtp({
      email,
      code: otpRaw,
      newPassword: "EdgePass999!",
    });
    let reused = false;
    try {
      await resetPasswordWithOtp({
        email,
        code: otpRaw,
        newPassword: "EdgePass111!",
      });
    } catch (error) {
      reused = error.status === 400;
    }
    assert(reused, "OTP cannot be reused after success");
  } finally {
    await prisma.emailToken.deleteMany({
      where: { userId: { in: [user.id, gUser.id] } },
    });
    await prisma.emailDeliveryLog.deleteMany({
      where: { userId: { in: [user.id, gUser.id] } },
    });
    await prisma.agent.deleteMany({ where: { userId: user.id } });
    await prisma.workspace.deleteMany({ where: { userId: user.id } });
    if (subscription) {
      await prisma.subscription.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: gUser.id } }).catch(() => {});
  }

  console.log("ok email-edge");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
