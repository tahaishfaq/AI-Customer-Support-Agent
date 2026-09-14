export function createSlidingWindowRateLimiter({ max, windowMs, now = () => Date.now() }) {
  const buckets = new Map();

  function consume(key) {
    const current = now();
    const bucket = buckets.get(key) || [];
    const active = bucket.filter((timestamp) => current - timestamp < windowMs);
    if (active.length >= max) {
      buckets.set(key, active);
      return false;
    }
    active.push(current);
    buckets.set(key, active);
    return true;
  }

  function clear() {
    buckets.clear();
  }

  return { consume, clear };
}

export function createTypingLeaseManager({ ttlMs, debounceMs, now = () => Date.now() }) {
  const leases = new Map();

  function start(key, onExpire) {
    const current = now();
    const previous = leases.get(key);
    const expiresAt = current + ttlMs;
    if (previous?.timer) clearTimeout(previous.timer);
    const shouldEmit = !previous || current - previous.lastEmittedAt >= debounceMs;
    const timer = setTimeout(() => {
      leases.delete(key);
      onExpire();
    }, ttlMs);
    leases.set(key, { lastEmittedAt: shouldEmit ? current : previous.lastEmittedAt, timer });
    return { shouldEmit, expiresAt };
  }

  function stop(key) {
    const lease = leases.get(key);
    if (!lease) return false;
    clearTimeout(lease.timer);
    leases.delete(key);
    return true;
  }

  function clear(onExpire) {
    for (const [key, lease] of leases) {
      clearTimeout(lease.timer);
      leases.delete(key);
      onExpire(key);
    }
  }

  return { start, stop, clear };
}
