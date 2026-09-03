/**
 * @param {{ used?: number, limit?: number|null, unlimited?: boolean }} quota
 */
export function conversationQuotaPercent(quota) {
  if (!quota || quota.unlimited || !quota.limit || quota.limit <= 0) return 0;
  return Math.min(100, Math.round((quota.used / quota.limit) * 100));
}

export function conversationQuotaWarningLevel(quota) {
  const pct = conversationQuotaPercent(quota);
  if (quota?.unlimited) return "ok";
  if (pct >= 100) return "exceeded";
  if (pct >= 90) return "critical";
  if (pct >= 75) return "warning";
  return "ok";
}

export function formatQuotaResetLabel(periodEnd) {
  if (!periodEnd) return "Resets monthly";
  try {
    const d = new Date(periodEnd);
    return `Resets ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return "Resets monthly";
  }
}
