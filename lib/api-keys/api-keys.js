/**
 * Level 2 · P7 — REST API keys. Pure. Format: `aide_sk_<prefix>_<secret>`. Only the sha256 of the
 * whole key is stored; the prefix finds the row, the hash is compared in constant time.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_SCOPES = Object.freeze(["read"]);
const KEY_RE = /^aide_sk_([A-Za-z0-9]{12})_([A-Za-z0-9_-]{32,64})$/;

export function hashApiKey(key) {
  return createHash("sha256").update(String(key)).digest("hex");
}

export function generateApiKey() {
  const prefix = randomBytes(9).toString("base64url").replace(/[-_]/g, "x").slice(0, 12);
  const secret = randomBytes(32).toString("base64url");
  const key = `aide_sk_${prefix}_${secret}`;
  return { key, prefix, keyHash: hashApiKey(key) };
}

/** `Authorization: Bearer aide_sk_…` → { key, prefix } or null. */
export function parseApiKey(authorization) {
  const match = String(authorization || "").match(/^Bearer\s+(\S+)$/i);
  const key = match?.[1] || "";
  const parts = key.match(KEY_RE);
  return parts ? { key, prefix: parts[1] } : null;
}

export function apiKeyMatches(key, storedHash) {
  const given = Buffer.from(hashApiKey(key), "hex");
  const expected = Buffer.from(String(storedHash || ""), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** What the owner sees after creation: the start of the key only. */
export function maskApiKey(prefix) {
  return `aide_sk_${prefix}_••••`;
}
