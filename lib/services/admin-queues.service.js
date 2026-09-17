/**
 * Admin-only BullMQ queue counts — no job payloads / secrets.
 */

import {
  BULLMQ_QUEUES,
  getQueue,
  isBullMqEnabled,
} from "../jobs/queues.js";

/**
 * @returns {Promise<{
 *   enabled: boolean,
 *   queues: Array<{ name: string, waiting: number, active: number, completed: number, failed: number, delayed: number }>
 * }>}
 */
export async function getAdminQueueCounts() {
  if (!isBullMqEnabled()) {
    return {
      enabled: false,
      queues: Object.values(BULLMQ_QUEUES).map((name) => ({
        name,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      })),
    };
  }

  const queues = [];
  for (const name of Object.values(BULLMQ_QUEUES)) {
    const queue = getQueue(name);
    if (!queue) {
      queues.push({
        name,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        unavailable: true,
      });
      continue;
    }
    try {
      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed"
      );
      queues.push({
        name,
        waiting: Number(counts.waiting) || 0,
        active: Number(counts.active) || 0,
        completed: Number(counts.completed) || 0,
        failed: Number(counts.failed) || 0,
        delayed: Number(counts.delayed) || 0,
      });
    } catch {
      queues.push({
        name,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        error: true,
      });
    }
  }

  return { enabled: true, queues };
}
