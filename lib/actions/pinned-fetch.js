/**
 * DNS-pinned outbound fetch (AIDE-GAP-001).
 * Resolves hostname once, validates IPs via SSRF, then connects only to a
 * validated address while preserving TLS SNI / certificate hostname checks.
 * Never sets rejectUnauthorized=false. Redirects stay caller-controlled (manual).
 */

import { Agent } from "undici";
import { isPrivateOrMetadataAddress } from "./ssrf.js";

/**
 * Prefer IPv4 public, else first non-private address.
 * @param {string[]} addresses
 * @returns {string|null}
 */
export function pickPinnedAddress(addresses) {
  const list = (addresses || [])
    .map((a) => String(a || "").toLowerCase().trim())
    .filter(Boolean);
  if (!list.length) return null;
  for (const addr of list) {
    if (isPrivateOrMetadataAddress(addr)) continue;
    if (!addr.includes(":")) return addr;
  }
  for (const addr of list) {
    if (!isPrivateOrMetadataAddress(addr)) return addr;
  }
  return null;
}

/**
 * @param {string} urlString
 * @param {RequestInit & { dispatcher?: unknown }} init
 * @param {{ addresses: string[], hostname: string }} pin
 * @returns {Promise<Response>}
 */
export async function pinnedFetch(urlString, init, pin) {
  const hostname = String(pin?.hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  const pinned = pickPinnedAddress(pin?.addresses || []);
  if (!hostname || !pinned) {
    const err = new Error("Pinned fetch requires validated hostname and address");
    err.code = "SSRF_BLOCKED";
    err.status = 400;
    throw err;
  }

  const family = pinned.includes(":") ? 6 : 4;
  const agent = new Agent({
    connect: {
      // Custom lookup returns only the pre-validated IP (blocks DNS rebinding TOCTOU).
      // TLS still uses the request URL hostname for SNI + cert verification.
      lookup(host, _opts, cb) {
        const h = String(host || "")
          .trim()
          .toLowerCase()
          .replace(/\.$/, "");
        if (h !== hostname) {
          cb(Object.assign(new Error("Unexpected host in pinned lookup"), { code: "SSRF_BLOCKED" }));
          return;
        }
        cb(null, pinned, family);
      },
    },
  });

  try {
    return await globalThis.fetch(urlString, {
      ...init,
      dispatcher: agent,
      redirect: init?.redirect ?? "manual",
    });
  } finally {
    try {
      await agent.close();
    } catch {
      /* best effort */
    }
  }
}
