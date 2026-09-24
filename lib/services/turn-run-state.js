/** Pure TurnRun state checks (no Prisma) — shared by the service and stream tests. */
export const ACTIVE_STATUSES = ["ACCEPTED", "PREPARING", "RUNNING", "WAITING_CONFIRMATION"];

/** Above the 60s stream deadline, so a crashed run stops blocking its clientMessageId. */
const IN_FLIGHT_WINDOW_MS = 90_000;

/** True when another request already owns this clientMessageId and is still running. */
export function isTurnRunInFlightElsewhere(run, requestId, now = Date.now()) {
  if (!run || !requestId || !run.requestId || run.requestId === requestId) return false;
  if (!ACTIVE_STATUSES.includes(run.status)) return false;
  return now - new Date(run.lastHeartbeatAt).getTime() < IN_FLIGHT_WINDOW_MS;
}
