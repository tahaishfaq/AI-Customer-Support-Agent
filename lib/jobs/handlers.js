/**
 * BullMQ job handlers — async side effects only (no PEP / identity).
 */

import { BILLING_JOBS, CRAWL_JOBS, EMAIL_JOBS } from "./queues.js";
import { acquireCrawlLock, releaseCrawlLock } from "./crawl-lock.js";

/**
 * @param {import("bullmq").Job} job
 */
export async function handleEmailJob(job) {
  const requestId = job.data?.requestId || null;
  const dryRun = Boolean(job.data?.dryRun);

  if (job.name === EMAIL_JOBS.ONBOARDING_DAY1_SWEEP) {
    const { sendOnboardingDay1Nudges } = await import(
      "../services/email-lifecycle.service.js"
    );
    const result = await sendOnboardingDay1Nudges({ dryRun });
    return {
      ok: true,
      job: EMAIL_JOBS.ONBOARDING_DAY1_SWEEP,
      requestId,
      sent: result.sent,
      skipped: result.skipped,
      dueCount: result.due?.length || 0,
      disabled: result.disabled || false,
    };
  }

  return {
    ok: false,
    error: "unknown_email_job",
    name: job.name,
    requestId,
  };
}

/**
 * @param {import("bullmq").Job} job
 */
export async function handleBillingJob(job) {
  const requestId = job.data?.requestId || null;
  const dryRun = Boolean(job.data?.dryRun);

  if (job.name === BILLING_JOBS.RENEWAL_REMINDER_SWEEP) {
    const { listRenewalRemindersDue } = await import(
      "../billing/renewal-reminders.js"
    );
    const result = await listRenewalRemindersDue({ dryRun });
    return {
      ok: true,
      job: BILLING_JOBS.RENEWAL_REMINDER_SWEEP,
      requestId,
      sent: result.sent,
      skipped: result.skipped,
      dueCount: result.due?.length || 0,
    };
  }

  return {
    ok: false,
    error: "unknown_billing_job",
    name: job.name,
    requestId,
  };
}

/**
 * @param {import("bullmq").Job} job
 */
export async function handleCrawlJob(job) {
  const requestId = job.data?.requestId || null;
  const siteCrawlJobId = String(job.data?.siteCrawlJobId || "").trim();
  const agentId = String(job.data?.agentId || "").trim();

  if (job.name !== CRAWL_JOBS.RUN_SITE_CRAWL) {
    return {
      ok: false,
      error: "unknown_crawl_job",
      name: job.name,
      requestId,
    };
  }

  if (!siteCrawlJobId || !agentId) {
    return { ok: false, error: "invalid_crawl_payload", requestId };
  }

  const lock = await acquireCrawlLock(agentId, { ttlSec: 900 });
  if (!lock.ok) {
    const err = new Error("CRAWL_LOCK_HELD");
    err.code = "CRAWL_LOCK_HELD";
    throw err;
  }

  try {
    const { runCrawlJob } = await import("../services/embed.service.js");
    await runCrawlJob(siteCrawlJobId, { requestId });
    return {
      ok: true,
      job: CRAWL_JOBS.RUN_SITE_CRAWL,
      siteCrawlJobId,
      agentId,
      requestId,
      lockBackend: lock.backend,
    };
  } finally {
    await releaseCrawlLock(agentId, lock.token);
  }
}
