/**
 * Unique TEST-NET-3 IP per call so local HTTP smokes do not share one
 * in-memory register rate-limit bucket (8 / 15min per IP).
 */
let seq = 0;

export function uniqueTestIpHeaders(extra = {}) {
  seq += 1;
  const n = 1 + ((Date.now() + seq * 17) % 254);
  return {
    "X-Forwarded-For": `203.0.113.${n}`,
    ...extra,
  };
}
