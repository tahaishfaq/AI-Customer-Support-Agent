/**
 * EM3 — Welcome / soft verify / day-1 nudge.
 * Run: npm run test:email-em3
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
  process.env.EMAIL_ONBOARDING_DRIP = "1";
  process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC = "0";

  for (const rel of [
    "lib/services/email-lifecycle.service.js",
    "app/api/auth/verify-email/route.js",
    "app/api/auth/resend-verify/route.js",
    "app/(auth)/verify-email/page.jsx",
    "components/auth/VerifyEmailBanner.jsx",
  ]) {
    assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  const authSvc = read("lib/services/auth.service.js");
  assert(/afterCredentialsRegister/.test(authSvc), "register sends EM3 mail");

  const templates = read("lib/email/templates/index.js");
  assert(/EMAIL_TEMPLATES\.WELCOME/.test(templates), "welcome registered");
  assert(/EMAIL_TEMPLATES\.VERIFY_EMAIL/.test(templates), "verify registered");
  assert(/EMAIL_TEMPLATES\.ONBOARDING_DAY1/.test(templates), "day1 registered");
  assert(/renderWelcome/.test(templates), "welcome renderer wired");

  if (!process.env.DATABASE_URL) {
    console.warn("skip EM3 DB gate (no DATABASE_URL)");
    console.log("ok email-em3 (static)");
    return;
  }

  const { clearEmailSink, drainEmailSink } = await import(
    "../lib/email/test-sink.js"
  );
  const {
    afterCredentialsRegister,
    verifyEmailWithToken,
    resendVerifyEmail,
    sendOnboardingDay1Nudges,
    sendWelcomeEmail,
  } = await import("../lib/services/email-lifecycle.service.js");
  const { createEmailToken } = await import("../lib/email/tokens.js");
  const { EMAIL_TOKEN_TYPES } = await import("../lib/email/constants.js");
  const prisma = (await import("../lib/prisma.js")).default;

  const stamp = Date.now();
  const email = `em3.${stamp}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "EM3 User",
      email,
      passwordHash: await bcrypt.hash("Em3Pass123!", 10),
      role: "USER",
      status: "ACTIVE",
    },
  });

  try {
    clearEmailSink();
    await afterCredentialsRegister(user);
    const sunk = drainEmailSink();
    const kinds = sunk.map((s) => s.template);
    assert(kinds.includes("welcome"), "welcome sent");
    assert(kinds.includes("verify_email"), "verify sent");

    // Duplicate welcome skipped
    const again = await sendWelcomeEmail(user);
    assert(again.skipped === true, "welcome idempotent");

    const verifyMail = sunk.find((s) => s.template === "verify_email");
    const raw = verifyMail.data.verifyUrl.split("token=")[1];
    assert(raw, "verify url has token");
    const token = decodeURIComponent(raw);

    await verifyEmailWithToken(token);
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    assert(updated.emailVerified, "emailVerified set");

    // Reuse rejected
    let reuseFail = false;
    try {
      await verifyEmailWithToken(token);
    } catch (error) {
      reuseFail = error.status === 400;
    }
    assert(reuseFail, "verify token single-use");

    // Resend when already verified — silent ok, no new mail
    clearEmailSink();
    await resendVerifyEmail(email);
    assert(drainEmailSink().length === 0, "no resend when verified");

    // Day-1 dry-run
    const dry = await sendOnboardingDay1Nudges({ dryRun: true });
    assert(Array.isArray(dry.due), "day1 dry-run lists due");

    // Expired verify
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: null },
    });
    const { raw: raw2, token: tok2 } = await createEmailToken({
      userId: user.id,
      type: EMAIL_TOKEN_TYPES.VERIFY_EMAIL,
      ttlSec: 1,
    });
    await prisma.emailToken.update({
      where: { id: tok2.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    let expired = false;
    try {
      await verifyEmailWithToken(raw2);
    } catch (error) {
      expired = error.code === "EXPIRED" || /expired/i.test(error.message);
    }
    assert(expired, "expired verify rejected");
  } finally {
    await prisma.emailToken.deleteMany({ where: { userId: user.id } });
    await prisma.emailDeliveryLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

  console.log("ok email-em3");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
