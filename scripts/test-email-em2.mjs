/**
 * EM2 — Contact + custom plan notify + dedupe.
 * Run: npm run test:email-em2
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function main() {
  process.env.EMAIL_TEST_MODE = "1";
  process.env.BILLING_ADMIN_EMAIL =
    process.env.BILLING_ADMIN_EMAIL || "ops-em2@example.com";

  const contact = read("app/api/contact/route.js");
  assert(/LANDING_CONTACT_ADMIN/.test(contact), "contact admin template");
  assert(/LANDING_CONTACT_ACK/.test(contact), "contact ack template");
  assert(/idempotencyKey/.test(contact), "contact idempotency");

  const custom = read("lib/billing/custom-request.service.js");
  assert(/CUSTOM_PLAN_REQUEST_ADMIN/.test(custom), "custom admin template");
  assert(/CUSTOM_PLAN_REQUEST_ACK/.test(custom), "custom ack template");
  assert(/custom_plan_admin:/.test(custom), "custom idempotency key");

  if (!process.env.DATABASE_URL) {
    console.warn("skip EM2 DB gate (no DATABASE_URL)");
    console.log("ok email-em2 (static)");
    return;
  }

  const { clearEmailSink, drainEmailSink } = await import(
    "../lib/email/test-sink.js"
  );
  const { sendEmail } = await import("../lib/email/send.js");
  const { EMAIL_TEMPLATES } = await import("../lib/email/constants.js");

  clearEmailSink();
  const key = `em2-contact:${Date.now()}`;
  await sendEmail({
    template: EMAIL_TEMPLATES.LANDING_CONTACT_ADMIN,
    to: process.env.BILLING_ADMIN_EMAIL.split(",")[0].trim(),
    data: {
      fullName: "EM2",
      email: "visitor@example.com",
      company: "Acme",
      message: "hello",
    },
    idempotencyKey: `${key}:admin`,
  });
  await sendEmail({
    template: EMAIL_TEMPLATES.LANDING_CONTACT_ACK,
    to: "visitor@example.com",
    data: { fullName: "EM2" },
    idempotencyKey: `${key}:ack`,
  });
  const dup = await sendEmail({
    template: EMAIL_TEMPLATES.LANDING_CONTACT_ADMIN,
    to: process.env.BILLING_ADMIN_EMAIL.split(",")[0].trim(),
    data: {
      fullName: "EM2",
      email: "visitor@example.com",
      company: "Acme",
      message: "hello",
    },
    idempotencyKey: `${key}:admin`,
  });
  assert(dup.skipped === true, "duplicate contact admin skipped");
  const sunk = drainEmailSink();
  assert(sunk.length === 2, `expected 2 sends, got ${sunk.length}`);

  console.log("ok email-em2");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
