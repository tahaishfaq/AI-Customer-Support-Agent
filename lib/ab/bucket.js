/**
 * Level 3 · L8 — deterministic A/B bucketing (pure). Winner is never auto-applied.
 */

export function normalizeAbTest(stored) {
  const raw = stored && typeof stored === "object" ? stored : {};
  return {
    enabled: Boolean(raw.enabled),
    revisionA: Number.isFinite(Number(raw.revisionA)) ? Number(raw.revisionA) : null,
    revisionB: Number.isFinite(Number(raw.revisionB)) ? Number(raw.revisionB) : null,
    minSample: Math.max(10, Number(raw.minSample) || 100),
    stopRule: String(raw.stopRule || "min_sample"),
  };
}

/** Prefer stable end-user subject over conversation id so one visitor stays in one bucket. */
export function abVisitorKey(conversation) {
  const subject = String(conversation?.customerSubject || conversation?.endUserSubject || "").trim();
  if (subject) return subject;
  return String(conversation?.id || "");
}

/** Stable A/B assignment from visitor id. */
export function assignAbBucket(visitorId, abTest) {
  const config = normalizeAbTest(abTest);
  if (!config.enabled || config.revisionA == null || config.revisionB == null) {
    return null;
  }
  const id = String(visitorId || "");
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  const bucket = hash % 2 === 0 ? "A" : "B";
  return {
    bucket,
    revisionVersion: bucket === "A" ? config.revisionA : config.revisionB,
  };
}

export function abReadyToStop({ samplesA, samplesB, minSample }) {
  const need = Math.max(10, Number(minSample) || 100);
  return Number(samplesA) >= need && Number(samplesB) >= need;
}
