/**
 * Wall-clock timeout for analytics loaders (Neon can stall under load).
 */

export const ANALYTICS_BUSY_MESSAGE =
  "Analytics busy, try a shorter range.";

export function analyticsBusyError(cause) {
  const err = new Error(ANALYTICS_BUSY_MESSAGE);
  err.status = 503;
  err.code = "ANALYTICS_TIMEOUT";
  if (cause) err.cause = cause;
  return err;
}

export function isAnalyticsBusyError(error) {
  if (!error) return false;
  if (error.status === 503 || error.status === 504) return true;
  if (error.code === "ANALYTICS_TIMEOUT") return true;
  const code = String(error.code || "");
  // Prisma / pg timeouts & connection drops that look like "slow"
  if (
    code === "P1008" ||
    code === "P1017" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "57P01"
  ) {
    return true;
  }
  const msg = String(error.message || "");
  return /timeout|timed out|canceling statement/i.test(msg);
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} [ms]
 * @returns {Promise<T>}
 */
export async function withAnalyticsTimeout(
  promise,
  ms = Number(process.env.ANALYTICS_TIMEOUT_MS) || 15_000
) {
  const raw = Number(ms);
  const limit = Number.isFinite(raw)
    ? Math.min(Math.max(raw, 1), 55_000)
    : 15_000;
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(analyticsBusyError()), limit);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
