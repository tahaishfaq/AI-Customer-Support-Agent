/**
 * Enqueue helpers — no-op when BULLMQ_ENABLED is off.
 * Never put raw OTP / passwords / ACTION secrets in job payloads.
 */

import {
  BILLING_JOBS,
  CRAWL_JOBS,
  EMAIL_JOBS,
  getBillingQueue,
  getCrawlQueue,
  getEmailQueue,
  isBullMqEnabled,
  sweepJobId,
} from "./queues.js";

/**
 * @returns {Promise<{ ok: true, jobId: string, queued: true } | { ok: false, reason: string }>}
 */
export async function enqueueOnboardingDay1Sweep({
  dryRun = false,
  requestId = null,
  bucket,
} = {}) {
  if (!isBullMqEnabled()) return { ok: false, reason: "bullmq_disabled" };
  const queue = getEmailQueue();
  if (!queue) return { ok: false, reason: "redis_unavailable" };
  const jobId = sweepJobId("email:onboarding_day1", bucket);
  await queue.add(
    EMAIL_JOBS.ONBOARDING_DAY1_SWEEP,
    {
      dryRun: Boolean(dryRun),
      requestId: requestId || null,
      enqueuedAt: new Date().toISOString(),
    },
    { jobId }
  );
  return { ok: true, jobId, queued: true };
}

/**
 * @returns {Promise<{ ok: true, jobId: string, queued: true } | { ok: false, reason: string }>}
 */
export async function enqueueRenewalReminderSweep({
  dryRun = false,
  requestId = null,
  bucket,
} = {}) {
  if (!isBullMqEnabled()) return { ok: false, reason: "bullmq_disabled" };
  const queue = getBillingQueue();
  if (!queue) return { ok: false, reason: "redis_unavailable" };
  const jobId = sweepJobId("billing:renewal_reminder", bucket);
  await queue.add(
    BILLING_JOBS.RENEWAL_REMINDER_SWEEP,
    {
      dryRun: Boolean(dryRun),
      requestId: requestId || null,
      enqueuedAt: new Date().toISOString(),
    },
    { jobId }
  );
  return { ok: true, jobId, queued: true };
}

/**
 * Enqueue a site crawl run. Idempotent on siteCrawlJobId.
 * Payload: ids + requestId only — never page HTML / secrets.
 * @returns {Promise<{ ok: true, jobId: string, queued: true } | { ok: false, reason: string }>}
 */
export async function enqueueSiteCrawlJob({
  siteCrawlJobId,
  agentId,
  requestId = null,
  delayMs = 0,
} = {}) {
  if (!isBullMqEnabled()) return { ok: false, reason: "bullmq_disabled" };
  const crawlJobId = String(siteCrawlJobId || "").trim();
  const agent = String(agentId || "").trim();
  if (!crawlJobId || !agent) return { ok: false, reason: "invalid_args" };

  const queue = getCrawlQueue();
  if (!queue) return { ok: false, reason: "redis_unavailable" };

  const jobId = `crawl:site:${crawlJobId}`;
  const opts = { jobId };
  const delay = Math.min(Math.max(Number(delayMs) || 0, 0), 10_000);
  if (delay > 0) opts.delay = delay;

  await queue.add(
    CRAWL_JOBS.RUN_SITE_CRAWL,
    {
      siteCrawlJobId: crawlJobId,
      agentId: agent,
      requestId: requestId || null,
      enqueuedAt: new Date().toISOString(),
    },
    opts
  );
  return { ok: true, jobId, queued: true };
}
