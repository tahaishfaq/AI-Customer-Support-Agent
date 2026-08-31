/**
 * F11-R1 — encrypt / decrypt ActionCredential secrets at rest.
 * Never hash API keys (need reversible plaintext for HTTP).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_VERSION = 1;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Derive a 32-byte key from ACTIONS_CREDENTIALS_KEY (or AUTH_SECRET fallback in dev).
 */
export function getActionsCredentialsKey() {
  const raw =
    process.env.ACTIONS_CREDENTIALS_KEY ||
    (process.env.NODE_ENV !== "production" ? process.env.AUTH_SECRET : null);
  if (!raw || String(raw).trim().length < 16) {
    throw httpError(
      500,
      "ACTIONS_CREDENTIALS_KEY is not configured (32+ char secret)",
      "CREDENTIALS_KEY_MISSING"
    );
  }
  return createHash("sha256").update(String(raw)).digest();
}

export function getActionsCredentialsKeyVersion() {
  const n = Number(process.env.ACTIONS_CREDENTIALS_KEY_VERSION);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : KEY_VERSION;
}

/**
 * @param {string} plaintext
 * @returns {string} base64url payload: v1.<iv>.<tag>.<ciphertext>
 */
export function encryptSecret(plaintext) {
  if (plaintext == null || String(plaintext) === "") {
    throw httpError(400, "Secret value is required", "SCHEMA_INVALID");
  }
  const key = getActionsCredentialsKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    `v${getActionsCredentialsKeyVersion()}`,
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

/**
 * @param {string} ciphertext
 * @returns {string} plaintext
 */
export function decryptSecret(ciphertext) {
  const parts = String(ciphertext || "").split(".");
  if (parts.length !== 4 || !parts[0].startsWith("v")) {
    throw httpError(500, "Invalid credential ciphertext", "CREDENTIAL_CORRUPT");
  }
  const key = getActionsCredentialsKey();
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw httpError(500, "Invalid credential ciphertext", "CREDENTIAL_CORRUPT");
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw httpError(500, "Failed to decrypt credential", "CREDENTIAL_DECRYPT");
  }
}

/** Never log or return this. */
export function assertNoSecretInText(text, label = "value") {
  const s = String(text || "");
  if (/Bearer\s+[A-Za-z0-9_\-./+=]{8,}/i.test(s) && !/\{\{/.test(s)) {
    throw httpError(400, `Do not store raw secrets in ${label}; use a credential`, "SCHEMA_INVALID");
  }
}
