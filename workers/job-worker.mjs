/**
 * BullMQ worker — email + billing + crawl processors (knowledge stub).
 * Run: BULLMQ_ENABLED=1 REDIS_ENABLED=1 npm run worker:jobs
 */

import { Worker } from "bullmq";
import {
  BULLMQ_QUEUES,
  getBullMqConnectionOptions,
  isBullMqEnabled,
} from "../lib/jobs/queues.js";
import {
  handleBillingJob,
  handleCrawlJob,
  handleEmailJob,
} from "../lib/jobs/handlers.js";

function logEvent(event, fields = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

async function main() {
  if (!isBullMqEnabled()) {
    console.error("BULLMQ_ENABLED is not set — refusing to start worker");
    process.exit(1);
  }
  const connection = getBullMqConnectionOptions();
  if (!connection) {
    console.error("Redis URL missing for BullMQ (REDIS_URL or REALTIME_REDIS_URL)");
    process.exit(1);
  }

  const emailConcurrency =
    Number(process.env.WORKER_CONCURRENCY_EMAIL || process.env.WORKER_CONCURRENCY || 5) ||
    5;
  const billingConcurrency =
    Number(process.env.WORKER_CONCURRENCY_BILLING || process.env.WORKER_CONCURRENCY || 3) ||
    3;
  const crawlConcurrency =
    Number(process.env.WORKER_CONCURRENCY_CRAWL || 1) || 1;

  const workers = [
    new Worker(BULLMQ_QUEUES.EMAIL, handleEmailJob, {
      connection,
      concurrency: emailConcurrency,
    }),
    new Worker(BULLMQ_QUEUES.BILLING, handleBillingJob, {
      connection,
      concurrency: billingConcurrency,
    }),
    new Worker(BULLMQ_QUEUES.CRAWL, handleCrawlJob, {
      connection,
      concurrency: crawlConcurrency,
    }),
    new Worker(
      BULLMQ_QUEUES.KNOWLEDGE,
      async (job) => {
        logEvent("job_scaffold", {
          queue: BULLMQ_QUEUES.KNOWLEDGE,
          jobId: job.id,
          name: job.name,
          requestId: job.data?.requestId || null,
        });
        return { ok: true, scaffold: true };
      },
      { connection, concurrency: 1 }
    ),
  ];

  for (const w of workers) {
    w.on("completed", (job, result) => {
      logEvent("job_completed", {
        queue: w.name,
        jobId: job?.id,
        name: job?.name,
        requestId: job?.data?.requestId || null,
        ok: result?.ok !== false,
      });
    });
    w.on("failed", (job, err) => {
      logEvent("job_failed", {
        queue: w.name,
        jobId: job?.id,
        name: job?.name,
        requestId: job?.data?.requestId || null,
        error: String(err?.message || err),
      });
    });
  }

  logEvent("worker_started", {
    queues: Object.values(BULLMQ_QUEUES),
    emailConcurrency,
    billingConcurrency,
    crawlConcurrency,
  });

  const shutdown = async () => {
    logEvent("worker_shutdown");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
