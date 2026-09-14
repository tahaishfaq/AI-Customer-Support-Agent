/**
 * EM1 — Password reset OTP production gate.
 * Run: npm run test:email-em1
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
  process.env.EMAIL_RESET_OTP_TTL_SEC = "300";
  process.env.EMAIL_RESET_OTP_MAX_ATTEMPTS = "5";
  process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC = "0";

  for (const rel of [
    "app/api/auth/forgot-password/route.js",
    "app/api/auth/reset-password/route.js",
    "app/(auth)/forgot-password/page.jsx",
    "app/(auth)/reset-password/page.jsx",
    "lib/services/password-reset.service.js",
    "lib/email/tokens.js",
  ]) {
    assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  const login = read("components/auth/LoginForm.jsx");
  assert(/forgot-password/.test(login), "login links to forgot-password");

  const proxy = read("proxy.js");
  assert(/forgot-password/.test(proxy), "proxy allows forgot-password");
  assert(/reset-password/.test(proxy), "proxy allows reset-password");

  const forgot = read("app/api/auth/forgot-password/route.js");
  assert(/forgotPasswordLimitOpts/.test(forgot), "forgot rate limited");
  assert(/jsonOk\(request, \{ ok: true \}\)/.test(forgot), "no enumeration");

  if (!process.env.DATABASE_URL) {
    console.warn("skip EM1 DB gate (no DATABASE_URL)");
    console.log("ok email-em1 (static)");
    return;
  }

  const { clearEmailSink, drainEmailSink } = await import(
    "../lib/email/test-sink.js"
  );
  const {
    requestPasswordResetOtp,
    resetPasswordWithOtp,
  } = await import("../lib/services/password-reset.service.js");
  const { consumePasswordResetOtp, createEmailToken, hashEmailToken } =
    await import("../lib/email/tokens.js");
  const prisma = (await import("../lib/prisma.js")).default;
  const { EMAIL_TOKEN_TYPES } = await import("../lib/email/constants.js");

  const stamp = Date.now();
  const email = `em1.reset.${stamp}@example.com`;
  const oldPass = "OldPass123!";
  const newPass = "NewPass456!";

  const user = await prisma.user.create({
    data: {
      name: "EM1 Reset",
      email,
      passwordHash: await bcrypt.hash(oldPass, 10),
      role: "USER",
      status: "ACTIVE",
    },
  });

  try {
    // Missing email still ok
    const missing = await requestPasswordResetOtp("missing-em1@example.com");
    assert(missing.ok === true, "missing email returns ok");

    clearEmailSink();
    await requestPasswordResetOtp(email);
    const sent = drainEmailSink();
    assert(sent.length === 1, "one OTP email");
    assert(sent[0].template === "password_reset_otp", "otp template");
    const code = sent[0].data.code;
    assert(/^\d{6}$/.test(code), "6-digit code");

    // Wrong code ×5 locks
    for (let i = 0; i < 5; i += 1) {
      const bad = await consumePasswordResetOtp({
        userId: user.id,
        code: "000000",
      });
      assert(bad.ok === false, `wrong attempt ${i + 1}`);
    }
    const locked = await consumePasswordResetOtp({
      userId: user.id,
      code,
    });
    assert(locked.ok === false, "locked after 5 wrong attempts");

    // Fresh OTP + success
    clearEmailSink();
    await requestPasswordResetOtp(email);
    const code2 = drainEmailSink()[0].data.code;

    await resetPasswordWithOtp({
      email,
      code: code2,
      newPassword: newPass,
    });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    assert(
      await bcrypt.compare(newPass, updated.passwordHash),
      "password updated"
    );
    assert(
      !(await bcrypt.compare(oldPass, updated.passwordHash)),
      "old password invalid"
    );

    // Reuse rejected
    let reuseFailed = false;
    try {
      await resetPasswordWithOtp({
        email,
        code: code2,
        newPassword: "AnotherPass789!",
      });
    } catch (error) {
      reuseFailed = error.status === 400;
    }
    assert(reuseFailed, "reused OTP rejected");

    // Expired OTP
    const { raw, token } = await createEmailToken({
      userId: user.id,
      type: EMAIL_TOKEN_TYPES.PASSWORD_RESET_OTP,
      ttlSec: 1,
    });
    await prisma.emailToken.update({
      where: { id: token.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await consumePasswordResetOtp({
      userId: user.id,
      code: raw,
    });
    assert(expired.reason === "expired", "expired OTP rejected");
    assert(hashEmailToken(raw).length === 64, "sha256 hex hash");

    // Prod without Resend → 503
    const prevTest = process.env.EMAIL_TEST_MODE;
    const prevNode = process.env.NODE_ENV;
    const prevKey = process.env.RESEND_API_KEY;
    process.env.EMAIL_TEST_MODE = "0";
    process.env.NODE_ENV = "production";
    delete process.env.RESEND_API_KEY;
    let got503 = false;
    try {
      await requestPasswordResetOtp(email);
    } catch (error) {
      got503 = error.status === 503;
    }
    process.env.EMAIL_TEST_MODE = prevTest;
    process.env.NODE_ENV = prevNode;
    if (prevKey != null) process.env.RESEND_API_KEY = prevKey;
    assert(got503, "prod without Resend returns 503");
  } finally {
    await prisma.emailToken.deleteMany({ where: { userId: user.id } });
    await prisma.emailDeliveryLog.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

  console.log("ok email-em1");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
