/**
 * EM0 — Resend wiring contract + idempotent send smoke.
 * Run: npm run test:email-em0
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(import.meta.url);

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

async function main() {
  assert(fs.existsSync(path.join(root, "lib/email/client.js")), "client.js");
  assert(fs.existsSync(path.join(root, "lib/email/send.js")), "send.js");
  assert(fs.existsSync(path.join(root, "lib/email/constants.js")), "constants.js");

  const pkg = JSON.parse(read("package.json"));
  assert(pkg.dependencies?.resend, "resend dependency installed");

  const schema = read("prisma/schema.prisma");
  assert(/model EmailDeliveryLog/.test(schema), "EmailDeliveryLog model");
  assert(/idempotencyKey\s+String\?\s+@unique/.test(schema), "unique idempotencyKey");

  const send = read("lib/email/send.js");
  assert(/idempotencyKey/.test(send), "sendEmail honors idempotencyKey");
  assert(/SKIPPED|skipped/.test(send), "duplicate send skips");

  const health = read("app/api/health/route.js");
  assert(/isEmailConfigured/.test(health), "health exposes email flag");
  assert(/email/.test(health), "health json includes email");

  const envExample = read(".env.example");
  assert(/RESEND_API_KEY/.test(envExample), "env example has Resend");
  assert(/EMAIL_FROM/.test(envExample), "env example has EMAIL_FROM");

  // Runtime smoke with alias loader parent
  process.env.EMAIL_TEST_MODE = "1";
  process.env.NODE_ENV = process.env.NODE_ENV || "test";

  const { isEmailConfigured, requireEmailConfigured } = await import(
    "../lib/email/client.js"
  );
  assert(typeof isEmailConfigured === "function", "isEmailConfigured export");
  assert(typeof requireEmailConfigured === "function", "requireEmailConfigured");

  const { listRegisteredTemplates } = await import(
    "../lib/email/templates/index.js"
  );
  const templates = listRegisteredTemplates();
  assert(templates.includes("password_reset_otp"), "otp template registered");
  assert(templates.includes("plan_subscribed"), "plan_subscribed registered");
  assert(
    templates.includes("subscription_cancel_scheduled"),
    "cancel scheduled registered"
  );

  if (process.env.DATABASE_URL) {
    const { sendEmail } = await import("../lib/email/send.js");
    const { clearEmailSink, drainEmailSink } = await import(
      "../lib/email/test-sink.js"
    );
    clearEmailSink();
    const key = `em0-smoke:${Date.now()}`;
    const first = await sendEmail({
      template: "landing_contact_ack",
      to: "em0-smoke@example.com",
      data: { fullName: "EM0" },
      idempotencyKey: key,
      tags: ["test"],
    });
    assert(first.ok === true, "first send ok");
    const second = await sendEmail({
      template: "landing_contact_ack",
      to: "em0-smoke@example.com",
      data: { fullName: "EM0" },
      idempotencyKey: key,
      tags: ["test"],
    });
    assert(second.skipped === true, "duplicate idempotencyKey skipped");
    const sunk = drainEmailSink();
    assert(sunk.length === 1, `sink should have 1 send, got ${sunk.length}`);
  } else {
    console.warn("skip DB send smoke (no DATABASE_URL)");
  }

  // Ensure package resolves
  require.resolve("resend");

  console.log("ok email-em0");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
