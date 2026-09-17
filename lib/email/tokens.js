import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  EMAIL_TOKEN_TYPES,
  resetOtpMaxAttempts,
  resetOtpTtlSec,
  verifyEmailTtlSec,
} from "@/lib/email/constants";
import {
  bumpResetOtpAttemptsInRedis,
  deleteResetOtpFromRedis,
  isResetOtpCooldownActive,
  markOtpLockedMetric,
  readResetOtpFromRedis,
  writeResetOtpToRedis,
} from "@/lib/email/otp-redis";

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
 * PASSWORD_RESET_OTP also dual-writes hash to Redis when enabled (audit stays in Postgres).
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

  // Drop stale Redis OTP when issuing a new one.
  if (type === EMAIL_TOKEN_TYPES.PASSWORD_RESET_OTP) {
    await deleteResetOtpFromRedis(userId);
  }

  const token = await prisma.emailToken.create({
    data: {
      userId,
      type,
      tokenHash,
      expiresAt,
    },
  });

  if (type === EMAIL_TOKEN_TYPES.PASSWORD_RESET_OTP) {
    await writeResetOtpToRedis({
      userId,
      tokenId: token.id,
      tokenHash,
      expiresAtMs: expiresAt.getTime(),
      ttlSec: ttl,
    });
  }

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

async function consumeViaPostgres({ userId, code }) {
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
      markOtpLockedMetric();
      await deleteResetOtpFromRedis(userId);
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid" };
  }

  const consumed = await prisma.emailToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });
  await deleteResetOtpFromRedis(userId);

  return { ok: true, token: consumed };
}

/**
 * Consume PASSWORD_RESET_OTP. Redis-first when present; Postgres audit + fallback.
 * @returns {{ ok: true, token } | { ok: false, reason: string }}
 */
export async function consumePasswordResetOtp({ userId, code }) {
  const cached = await readResetOtpFromRedis(userId);
  if (!cached) {
    return consumeViaPostgres({ userId, code });
  }

  const maxAttempts = resetOtpMaxAttempts();
  if (cached.expiresAtMs > 0 && cached.expiresAtMs <= Date.now()) {
    await deleteResetOtpFromRedis(userId);
    if (cached.tokenId) {
      await prisma.emailToken.updateMany({
        where: { id: cached.tokenId, usedAt: null },
        data: { usedAt: new Date() },
      });
    }
    return { ok: false, reason: "expired" };
  }

  if (cached.attempts >= maxAttempts) {
    markOtpLockedMetric();
    await deleteResetOtpFromRedis(userId);
    if (cached.tokenId) {
      await prisma.emailToken.updateMany({
        where: { id: cached.tokenId, usedAt: null },
        data: { usedAt: new Date() },
      });
    }
    return { ok: false, reason: "locked" };
  }

  const match = safeEqualHex(cached.tokenHash, hashEmailToken(code));
  if (!match) {
    const attempts = await bumpResetOtpAttemptsInRedis(userId);
    const next = attempts == null ? cached.attempts + 1 : attempts;
    if (cached.tokenId) {
      await prisma.emailToken.updateMany({
        where: { id: cached.tokenId },
        data: { attemptCount: next },
      });
    }
    if (next >= maxAttempts) {
      markOtpLockedMetric();
      await deleteResetOtpFromRedis(userId);
      if (cached.tokenId) {
        await prisma.emailToken.updateMany({
          where: { id: cached.tokenId, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid" };
  }

  await deleteResetOtpFromRedis(userId);
  let consumed = null;
  if (cached.tokenId) {
    consumed = await prisma.emailToken.update({
      where: { id: cached.tokenId },
      data: { usedAt: new Date() },
    });
  } else {
    // Redis without tokenId — fall back to mark active PG row used.
    const active = await findActiveOtpToken(userId);
    if (active) {
      consumed = await prisma.emailToken.update({
        where: { id: active.id },
        data: { usedAt: new Date() },
      });
    }
  }

  return { ok: true, token: consumed };
}

export async function latestUnusedOtpCreatedAt(userId) {
  if (await isResetOtpCooldownActive(userId)) {
    // Cooldown key present — treat as "just issued" for resend gate.
    return new Date();
  }
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
 * Long-lived verify tokens stay Postgres-primary (R1 scope).
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
