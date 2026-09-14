import prisma from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/billing/app-url";
import {
  EMAIL_TEMPLATES,
  EMAIL_TOKEN_TYPES,
  isEmailLoginAlertsEnabled,
  isEmailOnboardingDripEnabled,
  resetOtpResendCooldownSec,
  verifyEmailTtlSec,
} from "@/lib/email/constants";
import { sendEmail } from "@/lib/email/send";
import {
  consumeVerifyEmailToken,
  createEmailToken,
  latestUnusedVerifyCreatedAt,
} from "@/lib/email/tokens";

function safeSend(promise) {
  return promise.catch((error) => {
    console.error("[email] lifecycle send failed", {
      code: error.code || error.message,
    });
    return { ok: false, error };
  });
}

export async function sendWelcomeEmail(user) {
  if (!user?.email || !user?.id) return { ok: false };
  const base = getAppBaseUrl();
  return safeSend(
    sendEmail({
      template: EMAIL_TEMPLATES.WELCOME,
      to: user.email,
      userId: user.id,
      data: {
        name: user.name,
        dashboardUrl: `${base}/auth/continue`,
      },
      idempotencyKey: `welcome:${user.id}`,
      tags: ["auth", "welcome"],
    })
  );
}

export async function sendVerifyEmail(user, { force = false } = {}) {
  if (!user?.email || !user?.id) return { ok: false };
  if (user.emailVerified) return { ok: true, skipped: true, reason: "verified" };

  if (!force) {
    const lastAt = await latestUnusedVerifyCreatedAt(user.id);
    const cooldownMs = resetOtpResendCooldownSec() * 1000;
    if (lastAt && Date.now() - lastAt.getTime() < cooldownMs) {
      return { ok: true, skipped: true, reason: "cooldown" };
    }
  }

  const ttlSec = verifyEmailTtlSec();
  const { raw, token } = await createEmailToken({
    userId: user.id,
    type: EMAIL_TOKEN_TYPES.VERIFY_EMAIL,
    ttlSec,
  });
  const base = getAppBaseUrl();
  const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(raw)}`;

  return safeSend(
    sendEmail({
      template: EMAIL_TEMPLATES.VERIFY_EMAIL,
      to: user.email,
      userId: user.id,
      data: {
        name: user.name,
        verifyUrl,
        expiresHours: Math.round(ttlSec / 3600),
      },
      idempotencyKey: `verify_email:${token.id}`,
      tags: ["auth", "verify"],
    })
  );
}

/** After credentials register: welcome + soft verify (best-effort). */
export async function afterCredentialsRegister(user) {
  await sendWelcomeEmail(user);
  await sendVerifyEmail(user, { force: true });
}

/** After first Google account create: welcome only (already verified). */
export async function afterGoogleRegister(user) {
  await sendWelcomeEmail(user);
}

export async function verifyEmailWithToken(rawToken) {
  const result = await consumeVerifyEmailToken(rawToken);
  if (!result.ok) {
    const err = new Error(
      result.reason === "expired"
        ? "Verification link expired"
        : "Invalid verification link"
    );
    err.status = 400;
    err.code = result.reason?.toUpperCase() || "INVALID";
    throw err;
  }

  if (!result.alreadyVerified) {
    await prisma.user.update({
      where: { id: result.userId },
      data: { emailVerified: new Date() },
    });
  }

  // Invalidate any remaining verify tokens for this user.
  await prisma.emailToken.updateMany({
    where: {
      userId: result.userId,
      type: EMAIL_TOKEN_TYPES.VERIFY_EMAIL,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  return { ok: true, userId: result.userId };
}

/**
 * Resend verify — no enumeration. Always { ok: true } unless 503.
 */
export async function resendVerifyEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return { ok: true };

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      status: true,
      passwordHash: true,
    },
  });

  if (
    !user ||
    user.status === "SUSPENDED" ||
    !user.passwordHash ||
    user.emailVerified
  ) {
    return { ok: true };
  }

  await sendVerifyEmail(user);
  return { ok: true };
}

export async function maybeSendLoginAlert(user) {
  if (!isEmailLoginAlertsEnabled()) return { ok: true, skipped: true };
  if (!user?.email || !user?.id) return { ok: false };
  const base = getAppBaseUrl();
  const day = new Date().toISOString().slice(0, 13);
  return safeSend(
    sendEmail({
      template: EMAIL_TEMPLATES.LOGIN_ALERT,
      to: user.email,
      userId: user.id,
      data: {
        name: user.name,
        when: new Date().toLocaleString(),
        resetUrl: `${base}/forgot-password`,
      },
      idempotencyKey: `login_alert:${user.id}:${day}`,
      tags: ["auth", "login_alert"],
    })
  );
}

/**
 * Day-1 nudge: unlocked ~24h ago, still zero agents.
 */
export async function sendOnboardingDay1Nudges({
  now = new Date(),
  dryRun = false,
} = {}) {
  if (!isEmailOnboardingDripEnabled() && !dryRun) {
    return { due: [], sent: 0, skipped: 0, disabled: true };
  }

  const windowStart = new Date(now.getTime() - 30 * 60 * 60 * 1000); // 30h
  const windowEnd = new Date(now.getTime() - 18 * 60 * 60 * 1000); // 18h

  const subs = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      activatedAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          _count: { select: { agents: true } },
        },
      },
    },
    take: 500,
  });

  const due = [];
  for (const sub of subs) {
    const user = sub.user;
    if (!user?.email || user.status === "SUSPENDED") continue;
    if ((user._count?.agents || 0) > 0) continue;
    due.push({
      userId: user.id,
      email: user.email,
      subscriptionId: sub.id,
      activatedAt: sub.activatedAt,
    });
  }

  if (dryRun) {
    return { due, sent: 0, skipped: due.length, dryRun: true };
  }

  const base = getAppBaseUrl();
  let sent = 0;
  let skipped = 0;
  for (const row of due) {
    const user = await prisma.user.findUnique({
      where: { id: row.userId },
      select: { id: true, name: true, email: true },
    });
    const result = await safeSend(
      sendEmail({
        template: EMAIL_TEMPLATES.ONBOARDING_DAY1,
        to: user.email,
        userId: user.id,
        data: {
          name: user.name,
          dashboardUrl: `${base}/auth/continue`,
        },
        idempotencyKey: `onboarding_day1:${user.id}`,
        tags: ["onboarding", "day1"],
      })
    );
    if (result?.skipped) skipped += 1;
    else if (result?.ok) sent += 1;
    else skipped += 1;
  }

  return { due, sent, skipped, dryRun: false };
}
