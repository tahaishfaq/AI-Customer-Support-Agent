/**
 * R5 BullMQ email/billing jobs — no live Redis required.
 * Run: npm run test:bullmq-jobs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BILLING_JOBS,
  EMAIL_JOBS,
  isBullMqEnabled,
  sweepJobId,
} from "../lib/jobs/queues.js";
import { handleBillingJob, handleEmailJob } from "../lib/jobs/handlers.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testJobIds() {
  const a = sweepJobId("billing:renewal_reminder", "2026-09-17T12");
  const b = sweepJobId("billing:renewal_reminder", "2026-09-17T12");
  const c = sweepJobId("billing:renewal_reminder", "2026-09-17T13");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^billing:renewal_reminder:/);
  assert.equal(isBullMqEnabled(), false);
  console.log("ok  idempotent sweep job ids");
}

async function testHandlersDispatch() {
  const emailUnknown = await handleEmailJob({
    name: "NOPE",
    data: { requestId: "r1" },
  });
  assert.equal(emailUnknown.ok, false);
  assert.equal(emailUnknown.error, "unknown_email_job");

  const billingUnknown = await handleBillingJob({
    name: "NOPE",
    data: { requestId: "r2" },
  });
  assert.equal(billingUnknown.ok, false);

  // dryRun paths need DB when real handlers run — only assert names wired
  assert.equal(EMAIL_JOBS.ONBOARDING_DAY1_SWEEP, "ONBOARDING_DAY1_SWEEP");
  assert.equal(BILLING_JOBS.RENEWAL_REMINDER_SWEEP, "RENEWAL_REMINDER_SWEEP");
  console.log("ok  handler unknown-job contract");
}

function testWiring() {
  const worker = read("workers/job-worker.mjs");
  assert.match(worker, /handleEmailJob/);
  assert.match(worker, /handleBillingJob/);
  assert.match(worker, /WORKER_CONCURRENCY_EMAIL/);

  const enqueue = read("lib/jobs/enqueue.js");
  assert.match(enqueue, /enqueueRenewalReminderSweep/);
  assert.match(enqueue, /enqueueOnboardingDay1Sweep/);
  // Payload fields only — comments may mention OTP as forbidden.
  assert.doesNotMatch(
    enqueue.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    /\botp\b|password|tokenHash/i
  );

  const renewal = read("scripts/billing-renewal-reminders.mjs");
  assert.match(renewal, /enqueueRenewalReminderSweep/);
  assert.match(renewal, /--inline/);

  const day1 = read("scripts/email-onboarding-day1.mjs");
  assert.match(day1, /enqueueOnboardingDay1Sweep/);

  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["worker:jobs"], /register-aliases/);
  assert.equal(pkg.scripts["test:bullmq-jobs"], "node scripts/test-bullmq-jobs.mjs");

  const plan = read("docs/features/REDIS_BULLMQ_ENTERPRISE_PLAN.md");
  assert.match(plan, /Phase R5/);

  console.log("ok  worker + cron enqueue wiring");
}

testJobIds();
await testHandlersDispatch();
testWiring();
console.log("bullmq-jobs: ok");
