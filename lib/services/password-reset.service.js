import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireEmailConfigured } from "@/lib/email/client";
import { EMAIL_TEMPLATES, EMAIL_TOKEN_TYPES, resetOtpResendCooldownSec, resetOtpTtlSec } from "@/lib/email/constants";
import { sendEmail, EmailSendError } from "@/lib/email/send";
import {
  consumePasswordResetOtp,
  createEmailToken,
  latestUnusedOtpCreatedAt,
} from "@/lib/email/tokens";

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

/**
 * Always safe for callers: does not reveal whether the email exists.
 * Throws 503 only when production email is required and unavailable.
 */
export async function requestPasswordResetOtp(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return { ok: true };
  }

  if (!requireEmailConfigured()) {
    throw httpError(503, "Email service unavailable", "EMAIL_NOT_CONFIGURED");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      status: true,
    },
  });

  // No enumeration — silent skip for missing / suspended / Google-only.
  if (!user || user.status === "SUSPENDED" || !user.passwordHash) {
    return { ok: true };
  }

  const lastAt = await latestUnusedOtpCreatedAt(user.id);
  const cooldownMs = resetOtpResendCooldownSec() * 1000;
  if (lastAt && Date.now() - lastAt.getTime() < cooldownMs) {
    // Still 200 — avoid timing enumeration; client shows generic cooldown copy.
    return { ok: true, cooldown: true };
  }

  const ttlSec = resetOtpTtlSec();
  const { raw, token } = await createEmailToken({
    userId: user.id,
    type: EMAIL_TOKEN_TYPES.PASSWORD_RESET_OTP,
    ttlSec,
  });

  try {
    await sendEmail({
      template: EMAIL_TEMPLATES.PASSWORD_RESET_OTP,
      to: user.email,
      userId: user.id,
      data: {
        name: user.name,
        code: raw,
        expiresMinutes: Math.round(ttlSec / 60),
      },
      idempotencyKey: `password_reset_otp:${token.id}`,
      tags: ["auth", "password_reset"],
      requireConfigured: process.env.NODE_ENV === "production",
    });
  } catch (error) {
    if (error instanceof EmailSendError && error.status === 503) {
      throw httpError(503, "Email service unavailable", "EMAIL_NOT_CONFIGURED");
    }
    throw error;
  }

  return { ok: true };
}

export async function resetPasswordWithOtp({ email, code, newPassword }) {
  const normalized = String(email || "").trim().toLowerCase();
  const otp = String(code || "").trim();
  const password = String(newPassword || "");

  if (!normalized || !/^\d{6}$/.test(otp) || password.length < 8) {
    throw httpError(400, "Invalid reset request", "INVALID");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, passwordHash: true, status: true },
  });

  if (!user || user.status === "SUSPENDED" || !user.passwordHash) {
    throw httpError(400, "Invalid or expired code", "INVALID");
  }

  const result = await consumePasswordResetOtp({ userId: user.id, code: otp });
  if (!result.ok) {
    if (result.reason === "expired") {
      throw httpError(400, "Code expired. Request a new one.", "EXPIRED");
    }
    if (result.reason === "locked") {
      throw httpError(400, "Too many attempts. Request a new code.", "LOCKED");
    }
    throw httpError(400, "Invalid or expired code", "INVALID");
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Drop Auth.js sessions so old cookies cannot stay signed in.
  await prisma.session.deleteMany({ where: { userId: user.id } });

  return { ok: true };
}
