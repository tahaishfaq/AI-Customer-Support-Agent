/**
 * F11-R2 / F14-C — customer identity verify + end-user session resolve.
 * Strategies:
 *  - hs256_jwt: owner-signed JWT (identityToken / Bearer / accessToken alone)
 *  - host_session: host subject + optional opaque/site JWT accessToken for outbound
 * Payload JWT: { sub, iss?, aud?, exp } — sub required.
 */
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function getIdentitySecret() {
  const raw =
    process.env.ACTIONS_IDENTITY_SECRET ||
    (process.env.NODE_ENV !== "production" ? process.env.AUTH_SECRET : null);
  if (!raw || String(raw).trim().length < 16) {
    throw httpError(
      500,
      "ACTIONS_IDENTITY_SECRET is not configured",
      "IDENTITY_SECRET_MISSING"
    );
  }
  return String(raw);
}

function b64urlDecode(input) {
  const s = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64");
}

function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function looksLikeJwt(token) {
  const parts = String(token || "").split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/** Opaque fingerprint for logs — never store/log the raw token. */
export function fingerprintToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Persist / recover identity proof strategy on Conversation.identityIss.
 * Real JWT iss values are kept; host_session uses a sentinel.
 */
export const IDENTITY_ISS_HOST_SESSION = "aide:host_session";
export const IDENTITY_ISS_HS256_FALLBACK = "aide:hs256";

/**
 * @param {{ strategy?: string|null, iss?: string|null }|null} identity
 * @returns {string|null}
 */
export function identityIssForStorage(identity) {
  if (!identity?.sub && !identity?.strategy) return null;
  const strategy = String(identity?.strategy || "").toLowerCase();
  if (strategy === "host_session") return IDENTITY_ISS_HOST_SESSION;
  if (strategy === "hs256_jwt") {
    const iss = String(identity?.iss || "").trim();
    return iss || IDENTITY_ISS_HS256_FALLBACK;
  }
  return identity?.iss ?? null;
}

/**
 * @param {{ identityIss?: string|null, customerSubject?: string|null }|null} conversation
 * @param {string|null} [liveStrategy]
 * @returns {"hs256_jwt"|"host_session"|null}
 */
export function resolveIdentityStrategyFromConversation(
  conversation,
  liveStrategy = null
) {
  const live = String(liveStrategy || "").trim().toLowerCase();
  if (live === "hs256_jwt" || live === "host_session") return live;

  const iss = String(conversation?.identityIss || "").trim();
  if (iss === IDENTITY_ISS_HOST_SESSION) return "host_session";
  if (iss === IDENTITY_ISS_HS256_FALLBACK) return "hs256_jwt";
  if (iss) return "hs256_jwt"; // merchant/custom iss from a verified JWT
  if (conversation?.customerSubject) return "host_session"; // legacy unproven
  return null;
}

/**
 * Verify HS256 JWT. Returns { sub, iss?, aud?, exp }.
 * @param {string} token
 * @param {{ expectedAgentId?: string|null, expectedAud?: string|null }} [opts]
 */
export function verifyCustomerIdentityToken(token, opts = {}) {
  const raw = String(token || "").trim();
  if (!raw) {
    throw httpError(401, "Identity token required", "IDENTITY_REQUIRED");
  }

  const parts = raw.split(".");
  if (parts.length !== 3) {
    throw httpError(401, "Invalid identity token", "IDENTITY_INVALID");
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header;
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString("utf8"));
  } catch {
    throw httpError(401, "Invalid identity token header", "IDENTITY_INVALID");
  }
  if (header?.alg !== "HS256" || (header.typ && header.typ !== "JWT")) {
    throw httpError(401, "Unsupported identity token algorithm", "IDENTITY_INVALID");
  }

  const secret = getIdentitySecret();
  const expected = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actual = b64urlDecode(sigB64);
  if (!safeEqual(expected, actual)) {
    throw httpError(401, "Invalid identity token signature", "IDENTITY_INVALID");
  }

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    throw httpError(401, "Invalid identity token payload", "IDENTITY_INVALID");
  }

  const sub = payload?.sub;
  if (typeof sub !== "string" || !sub.trim()) {
    throw httpError(401, "Identity token missing sub", "IDENTITY_INVALID");
  }

  if (payload.exp != null) {
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
      throw httpError(401, "Identity token expired", "IDENTITY_EXPIRED");
    }
  }

  const iss = typeof payload.iss === "string" ? payload.iss : undefined;
  const aud = typeof payload.aud === "string" ? payload.aud : undefined;
  const expectedAgentId = String(opts.expectedAgentId || "").trim() || null;
  const expectedAud = String(opts.expectedAud || "").trim() || null;

  if (expectedAgentId && iss && iss.startsWith("aide:agent:")) {
    if (iss !== `aide:agent:${expectedAgentId}`) {
      throw httpError(401, "Identity token agent mismatch", "IDENTITY_INVALID");
    }
  }
  if (aud) {
    const allowedAud = new Set(
      [expectedAud, expectedAgentId ? `aide:agent:${expectedAgentId}` : null, "aide-embed"]
        .filter(Boolean)
    );
    // When caller passes expectedAud/agent, enforce; otherwise accept known Aide auds only if set.
    if (expectedAud || expectedAgentId) {
      if (!allowedAud.has(aud)) {
        throw httpError(401, "Identity token audience mismatch", "IDENTITY_INVALID");
      }
    }
  }

  return {
    sub: sub.trim(),
    iss,
    aud,
    exp: payload.exp != null ? Number(payload.exp) : undefined,
    email:
      typeof payload.email === "string" ? payload.email.trim() : undefined,
    phone:
      typeof payload.phone === "string"
        ? payload.phone.trim()
        : typeof payload.phone_number === "string"
          ? payload.phone_number.trim()
          : undefined,
  };
}

function clip(value, max) {
  const s = String(value || "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * F14-C — Resolve end-user identity from chat request inputs.
 * Prefers signed JWT; falls back to host session subject + optional opaque token.
 *
 * @returns {null | {
 *   sub: string,
 *   displayName: string|null,
 *   iss?: string,
 *   exp?: number,
 *   accessToken: string|null,
 *   tokenFingerprint: string|null,
 *   strategy: "hs256_jwt"|"host_session",
 * }}
 */
export function resolveEndUserIdentity({
  identityToken = null,
  bearerToken = null,
  userSession = null,
  expectedAgentId = null,
  expectedAud = "aide-embed",
} = {}) {
  const session =
    userSession && typeof userSession === "object" ? userSession : null;
  const sessionSubject = clip(session?.subject || session?.sub || "", 320);
  const sessionDisplay = clip(
    session?.displayName || session?.name || "",
    200
  );
  const sessionAccess = clip(
    session?.accessToken || session?.token || "",
    8192
  );
  const verifyOpts = {
    expectedAgentId: clip(expectedAgentId, 64),
    expectedAud: clip(expectedAud, 200),
  };

  // Aide-signed identity JWT only from identityToken / Authorization Bearer.
  // When the host also sends subject (setUser), accessToken is always opaque
  // outbound auth (Brandly/site JWT) — never verified with ACTIONS_IDENTITY_SECRET.
  const jwtCandidates = [
    clip(identityToken, 8192),
    clip(bearerToken, 8192),
    !sessionSubject && sessionAccess && looksLikeJwt(sessionAccess)
      ? sessionAccess
      : null,
  ].filter(Boolean);

  for (const token of jwtCandidates) {
    if (!looksLikeJwt(token)) continue;
    const claims = verifyCustomerIdentityToken(token, verifyOpts);
    if (sessionSubject && sessionSubject !== claims.sub) {
      throw httpError(401, "Identity subject mismatch", "IDENTITY_INVALID");
    }
    return {
      sub: claims.sub,
      displayName: sessionDisplay,
      iss: claims.iss,
      aud: claims.aud,
      exp: claims.exp,
      email: claims.email || null,
      phone: claims.phone || null,
      accessToken: sessionAccess || token,
      tokenFingerprint: fingerprintToken(sessionAccess || token),
      strategy: "hs256_jwt",
    };
  }

  // Opaque host session: origin-locked embed trusts host subject; token for outbound only.
  if (sessionSubject) {
    return {
      sub: sessionSubject,
      displayName: sessionDisplay,
      email: clip(session?.email || "", 320),
      phone: clip(session?.phone || "", 64),
      accessToken: sessionAccess,
      tokenFingerprint: fingerprintToken(sessionAccess),
      strategy: "host_session",
    };
  }

  return null;
}

/**
 * Stable hash of args for confirmation matching.
 * @param {unknown} args
 */
export function hashArgs(args) {
  const normalized = normalizeForHash(args);
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

function normalizeForHash(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = normalizeForHash(value[key]);
    }
    return out;
  }
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return value;
}

/** Test helper — sign a token (dev/smoke only). */
export function signCustomerIdentityToken(payload, secret = null) {
  const key = secret || getIdentitySecret();
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", key)
    .update(`${header}.${body}`)
    .digest();
  return `${header}.${body}.${b64urlEncode(sig)}`;
}

export const DEFAULT_IDENTITY_TOKEN_TTL_SECONDS = 3600;
export const MAX_IDENTITY_TOKEN_TTL_SECONDS = 24 * 3600;

/**
 * Mint an Aide-verified end-user identity JWT (server-only).
 * Merchants must call this from a trusted backend — never from embed JS.
 *
 * @param {{
 *   sub: string,
 *   ttlSeconds?: number,
 *   email?: string|null,
 *   phone?: string|null,
 *   iss?: string|null,
 *   aud?: string|null,
 * }} opts
 * @returns {{ token: string, expiresAt: string, sub: string }}
 */
export function mintEndUserIdentityToken(opts = {}) {
  const sub = clip(opts.sub, 320);
  if (!sub) {
    throw httpError(400, "sub is required", "IDENTITY_SUB_REQUIRED");
  }
  let ttl = Number(opts.ttlSeconds);
  if (!Number.isFinite(ttl) || ttl <= 0) ttl = DEFAULT_IDENTITY_TOKEN_TTL_SECONDS;
  ttl = Math.min(Math.floor(ttl), MAX_IDENTITY_TOKEN_TTL_SECONDS);

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    sub,
    iat: nowSec,
    exp: nowSec + ttl,
  };
  const email = clip(opts.email, 320);
  const phone = clip(opts.phone, 64);
  const iss = clip(opts.iss, 200);
  const aud = clip(opts.aud, 200);
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (iss) payload.iss = iss;
  if (aud) payload.aud = aud;

  const token = signCustomerIdentityToken(payload);
  return {
    token,
    sub,
    expiresAt: new Date((nowSec + ttl) * 1000).toISOString(),
    ttlSeconds: ttl,
  };
}
