/**
 * Level 3 · L5 — resolution charge / reverse ledger (pure helpers).
 */

export const CHARGE_STATUS = Object.freeze({
  CHARGED: "CHARGED",
  REVERSED: "REVERSED",
});

export const REVERSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const SETTLE_MS = 24 * 60 * 60 * 1000;

/** AI-resolved conversation eligible for charge (M2-aligned, pure). */
export function isChargeableResolution(row) {
  if (!row) return false;
  if (row.source === "STUDIO" || row.isSimulation) return false;
  if (row.handoffCount > 0) return false;
  if (row.negativeFeedback) return false;
  if (["NO_EVIDENCE", "NOT_FOUND", "DEGRADED", "HANDOFF"].includes(row.lastAnswerState)) {
    return false;
  }
  if (!row.lastMessageAt) return false;
  const age = Date.now() - new Date(row.lastMessageAt).getTime();
  return age >= SETTLE_MS;
}

export function shouldReverseCharge({ chargedAt, reason, now = Date.now() }) {
  if (!chargedAt) return false;
  const age = now - new Date(chargedAt).getTime();
  if (age > REVERSE_WINDOW_MS) return false;
  return ["handoff", "thumbs_down", "reopen"].includes(String(reason || ""));
}

export function monthUtcBounds(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}
