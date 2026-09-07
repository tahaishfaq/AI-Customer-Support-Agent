import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  EMAIL_TOKEN_TYPES,
  resetOtpMaxAttempts,
  resetOtpTtlSec,
  verifyEmailTtlSec,
} from "@/lib/email/constants";

export function hashEmailToken(raw) {
  return createHash("sha256").update(String(raw), "utf8").digest("hex");
}

export function generateSixDigitOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function generateVerifyRawToken() {
  return randomBytes(32).toString("base64url");
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Invalidate unused tokens of the same type, then create a new hashed token.
 * @returns {{ raw: string, token: object }}
 */
export async function createEmailToken({
  userId,
  type,
  rawToken,
  ttlSec,
}) {
  const ttl =
    Number.isFinite(ttlSec) && ttlSec > 0
      ? ttlSec
      : type === EMAIL_TOKEN_TYPES.VERIFY_EMAIL
        ? verifyEmailTtlSec()
        : resetOtpTtlSec();
  const raw =
    rawToken ||
    (type === EMAIL_TOKEN_TYPES.VERIFY_EMAIL
      ? generateVerifyRawToken()
      : generateSixDigitOtp());
  const tokenHash = hashEmailToken(raw);
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await prisma.emailToken.updateMany({
    where: {
      userId,
      type,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  const token = await prisma.emailToken.create({
    data: {
      userId,
      type,
      tokenHash,
      expiresAt,
    },
  });

  return { raw, token };
}

export async function findActiveOtpToken(userId) {
  return prisma.emailToken.findFirst({
    where: {
      userId,
      type: EMAIL_TOKEN_TYPES.PASSWORD_RESET_OTP,
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Consume PASSWORD_RESET_OTP. Enforces expiry + attempt budget.
 * @returns {{ ok: true, token } | { ok: false, reason: string }}
 */
export async function consumePasswordResetOtp({ userId, code }) {
  const token = await findActiveOtpToken(userId);
  if (!token) {
    return { ok: false, reason: "invalid" };
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    await prisma.emailToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    return { ok: false, reason: "expired" };
  }

  const maxAttempts = resetOtpMaxAttempts();
  if (token.attemptCount >= maxAttempts) {
    return { ok: false, reason: "locked" };
  }

  const match = safeEqualHex(token.tokenHash, hashEmailToken(code));
  if (!match) {
    const updated = await prisma.emailToken.update({
      where: { id: token.id },
      data: { attemptCount: { increment: 1 } },
    });
    if (updated.attemptCount >= maxAttempts) {
      await prisma.emailToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid" };
  }

  const consumed = await prisma.emailToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, token: consumed };
}

export async function latestUnusedOtpCreatedAt(userId) {
  const row = await prisma.emailToken.findFirst({
    where: {
      userId,
      type: EMAIL_TOKEN_TYPES.PASSWORD_RESET_OTP,
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt || null;
}

/**
 * Consume VERIFY_EMAIL by raw token from link.
 * Idempotent: already-used token still succeeds if that user is verified
 * (handles React Strict Mode double POST + re-clicks).
 * @returns {{ ok: true, userId, alreadyVerified?: boolean } | { ok: false, reason: string }}
 */
export async function consumeVerifyEmailToken(raw) {
  const tokenHash = hashEmailToken(String(raw || "").trim());
  if (!tokenHash || tokenHash.length < 32) {
    return { ok: false, reason: "invalid" };
  }

  const token = await prisma.emailToken.findFirst({
    where: {
      tokenHash,
      type: EMAIL_TOKEN_TYPES.VERIFY_EMAIL,
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    const used = await prisma.emailToken.findFirst({
      where: {
        tokenHash,
        type: EMAIL_TOKEN_TYPES.VERIFY_EMAIL,
      },
      orderBy: { createdAt: "desc" },
    });
    if (used) {
      const user = await prisma.user.findUnique({
        where: { id: used.userId },
        select: { emailVerified: true },
      });
      if (user?.emailVerified) {
        return { ok: true, userId: used.userId, alreadyVerified: true };
      }
      if (used.expiresAt.getTime() <= Date.now()) {
        return { ok: false, reason: "expired" };
      }
    }
    return { ok: false, reason: "invalid" };
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    await prisma.emailToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    return { ok: false, reason: "expired" };
  }

  await prisma.emailToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, userId: token.userId, token };
}

export async function latestUnusedVerifyCreatedAt(userId) {
  const row = await prisma.emailToken.findFirst({
    where: {
      userId,
      type: EMAIL_TOKEN_TYPES.VERIFY_EMAIL,
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt || null;
}
