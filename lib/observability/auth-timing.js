import { safeLogInfo } from "@/lib/observability/safe-log";

/**
 * Optional auth redirect timing. Disabled unless explicitly enabled so normal
 * sign-ins do not add log volume or expose user-related request details.
 */
export function logAuthTiming(event, startedAt, meta = {}) {
  if (process.env.AUTH_TIMING_LOG !== "1") return;

  safeLogInfo("auth timing", {
    event,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    route: meta.route,
    status: meta.status,
  });
}

export function startAuthTiming() {
  return performance.now();
}
