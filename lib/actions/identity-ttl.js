/**
 * F14-E — end-user identity session TTL helpers.
 */

function intEnv(name, fallback, { min = 1_000, max = 7 * 24 * 60 * 60_000 } = {}) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/** Max lifetime for opaque host sessions (no JWT exp). Default 1h. */
export function identitySessionMaxTtlMs() {
  return intEnv("IDENTITY_SESSION_MAX_TTL_MS", 60 * 60 * 1000);
}

/**
 * @param {{ exp?: number|null }} identity
 * @returns {Date}
 */
export function resolveIdentityExpiresAt(identity) {
  if (identity?.exp != null && Number.isFinite(Number(identity.exp))) {
    return new Date(Number(identity.exp) * 1000);
  }
  return new Date(Date.now() + identitySessionMaxTtlMs());
}

/**
 * @param {{ identityExpiresAt?: Date|string|null }|null} conversation
 */
export function isConversationIdentityExpired(conversation) {
  if (!conversation?.identityExpiresAt) return false;
  const t = new Date(conversation.identityExpiresAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}
