/**
 * Wall-clock duration for response headers (client / Network tab baselines).
 */
export function durationMsSince(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

export function durationHeaders(startedAt) {
  return {
    "x-aide-duration-ms": String(durationMsSince(startedAt)),
  };
}
