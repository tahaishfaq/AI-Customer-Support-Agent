import { safeLogWarn } from "./safe-log.js";

/**
 * Placeholder for future background-job dead-letter + alert hooks.
 * Today: structured warn log only (no external side effects).
 * Later: persist DLQ row, call DEAD_LETTER_WEBHOOK_URL, page ops, etc.
 *
 * @param {{
 *   jobType: string,
 *   jobId?: string,
 *   requestId?: string,
 *   agentId?: string,
 *   code?: string,
 *   reason?: string,
 * }} event
 */
export async function enqueueDeadLetter(event = {}) {
  const code = event.code || "DEAD_LETTER";
  safeLogWarn("dead-letter", {
    requestId: event.requestId,
    agentId: event.agentId,
    jobId: event.jobId,
    route: event.jobType || "job",
    code,
  });

  // Hook reserved for later — do not send HTTP yet (avoid silent prod traffic).
  if (process.env.DEAD_LETTER_WEBHOOK_URL?.trim()) {
    safeLogWarn("dead-letter webhook placeholder", {
      requestId: event.requestId,
      jobId: event.jobId,
      code: "DLQ_HOOK_PLACEHOLDER",
      route: event.jobType || "job",
    });
  }
}
