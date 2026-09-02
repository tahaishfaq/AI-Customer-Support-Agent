/** F12 Human Desk — tunable defaults (Phase E–G). */

export const DESK_WAITING_SOFT_CAP = 20;

export const DESK_INBOX_POLL_MS = 10_000;

export const DESK_EMBED_POLL_MS = 8_000;

/** Faster poll while waiting for the first human reply. */
export const DESK_EMBED_WAIT_POLL_MS = 3_000;

/** No human reply within this window → show offline fallback in embed. */
export const DESK_WAIT_TIMEOUT_MS = 60_000;

/** Owner typing heartbeat visible to customer for this long. */
export const DESK_HUMAN_TYPING_TTL_MS = 4_000;

export const DESK_NAV_BADGE_POLL_MS = 30_000;

export const DESK_HANDOFF_RATE_LIMIT = 5;

/** Max "Talk to a human" requests allowed in one conversation. */
export const DESK_HANDOFF_MAX_PER_CONVERSATION = 3;

/** After human resolves / returns to AI, wait this long before next handoff. */
export const DESK_HANDOFF_REOPEN_COOLDOWN_MS = 30 * 60_000;
