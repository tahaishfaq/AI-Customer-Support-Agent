/**
 * BullMQ queue names + connection helper.
 * Jobs must NOT carry PEP/identity authority — only async side effects.
 * Enable with BULLMQ_ENABLED=1 (and Redis URL).
 */

import { Queue } from "bullmq";

export const BULLMQ_QUEUES = Object.freeze({
  EMAIL: "email",
  BILLING: "billing",
  CRAWL: "crawl",
  KNOWLEDGE: "knowledge",
});

export const EMAIL_JOBS = Object.freeze({
  ONBOARDING_DAY1_SWEEP: "ONBOARDING_DAY1_SWEEP",
});

export const BILLING_JOBS = Object.freeze({
  RENEWAL_REMINDER_SWEEP: "RENEWAL_REMINDER_SWEEP",
});

export const CRAWL_JOBS = Object.freeze({
  RUN_SITE_CRAWL: "RUN_SITE_CRAWL",
});

/** @type {Map<string, import("bullmq").Queue>} */
const queueCache = new Map();

export function isBullMqEnabled() {
  const flag = String(process.env.BULLMQ_ENABLED || "")
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/**
 * Connection options for BullMQ (shares REDIS_URL / REALTIME_REDIS_URL).
 * Returns null when disabled or URL missing.
 */
export function getBullMqConnectionOptions() {
  if (!isBullMqEnabled()) return null;
  const url =
    String(process.env.REDIS_URL || "").trim() ||
    String(process.env.REALTIME_REDIS_URL || "").trim();
  if (!url) return null;
  return {
    url,
    username:
      process.env.REDIS_USERNAME ||
      process.env.REALTIME_REDIS_USERNAME ||
      undefined,
    password:
      process.env.REDIS_PASSWORD ||
      process.env.REALTIME_REDIS_PASSWORD ||
      undefined,
    maxRetriesPerRequest: null,
  };
}

export function defaultJobOptions() {
  return {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: 86_400, count: 1_000 },
    removeOnFail: { age: 7 * 86_400 },
  };
}

/**
 * Idempotent job id helper — date-bucketed sweeps avoid duplicate spam.
 * @param {string} prefix
 * @param {string} [bucket] YYYY-MM-DD or YYYY-MM-DD-HH
 */
export function sweepJobId(prefix, bucket = new Date().toISOString().slice(0, 13)) {
  const safe = String(bucket).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 40);
  return `${prefix}:${safe}`;
}

/**
 * @param {string} name
 * @returns {import("bullmq").Queue | null}
 */
export function getQueue(name) {
  const connection = getBullMqConnectionOptions();
  if (!connection) return null;
  if (queueCache.has(name)) return queueCache.get(name);
  const queue = new Queue(name, {
    connection,
    defaultJobOptions: defaultJobOptions(),
  });
  queueCache.set(name, queue);
  return queue;
}

export function getEmailQueue() {
  return getQueue(BULLMQ_QUEUES.EMAIL);
}

export function getBillingQueue() {
  return getQueue(BULLMQ_QUEUES.BILLING);
}

export function getCrawlQueue() {
  return getQueue(BULLMQ_QUEUES.CRAWL);
}

/** Test helper */
export async function __closeQueuesForTests() {
  for (const q of queueCache.values()) {
    try {
      await q.close();
    } catch {
      // ignore
    }
  }
  queueCache.clear();
}
