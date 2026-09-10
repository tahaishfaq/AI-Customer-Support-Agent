export function logClientAuthTiming(event, startedAt) {
  if (
    typeof window === "undefined" ||
    process.env.NEXT_PUBLIC_AUTH_TIMING_LOG !== "1"
  ) {
    return;
  }

  console.info("[auth timing]", {
    event,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
  });
}
