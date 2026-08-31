/**
 * SSRF guards for F11 HTTP action URLs.
 * Blocks private / link-local / metadata hosts before outbound fetch.
 * R3: DNS pin — resolve all A/AAAA and reject if any address is private.
 */
import dns from "node:dns";

const dnsLookup = dns.promises.lookup;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

function ipv4ToInt(ip) {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateIpv4(ip) {
  const n = ipv4ToInt(ip);
  if (n == null) return false;
  // 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16
  if (n >= 0x00000000 && n <= 0x00ffffff) return true;
  if (n >= 0x0a000000 && n <= 0x0affffff) return true;
  if (n >= 0x7f000000 && n <= 0x7fffffff) return true;
  if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true;
  if (n >= 0xac100000 && n <= 0xac1fffff) return true;
  if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true;
  return false;
}

function isPrivateIpv6(host) {
  const h = host.toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA rough
  if (h.startsWith("fe80")) return true;
  return false;
}

export function isBlockedHostname(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIpv4(host)) return true;
  if (host.includes(":") && isPrivateIpv6(host)) return true;
  // Cloud metadata IPv4
  if (host === "169.254.169.254") return true;
  return false;
}

/**
 * Allow http only for local demo hosts when explicitly enabled.
 */
export function assertActionUrlSafe(rawUrl, { allowLocalDemo = false } = {}) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ""));
  } catch {
    const err = new Error("Invalid URL");
    err.code = "SSRF_BLOCKED";
    err.status = 400;
    throw err;
  }

  const protocol = parsed.protocol.toLowerCase();
  const isLocalHost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  if (protocol === "http:") {
    if (!(allowLocalDemo && isLocalHost)) {
      const err = new Error("Only https URLs are allowed");
      err.code = "SSRF_BLOCKED";
      err.status = 400;
      throw err;
    }
  } else if (protocol !== "https:") {
    const err = new Error("Only https URLs are allowed");
    err.code = "SSRF_BLOCKED";
    err.status = 400;
    throw err;
  }

  if (!allowLocalDemo || !isLocalHost) {
    if (isBlockedHostname(parsed.hostname)) {
      const err = new Error("URL host is not allowed");
      err.code = "SSRF_BLOCKED";
      err.status = 400;
      throw err;
    }
  }

  return parsed;
}

/**
 * Resolve hostname and reject if ANY address is private/metadata.
 * @returns {Promise<{ parsed: URL, addresses: string[] }>}
 */
export async function assertActionUrlSafePinned(
  rawUrl,
  { allowLocalDemo = false } = {}
) {
  const parsed = assertActionUrlSafe(rawUrl, { allowLocalDemo });
  const isLocalHost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  if (allowLocalDemo && isLocalHost) {
    return { parsed, addresses: ["127.0.0.1"] };
  }

  // Literal IP already checked in assertActionUrlSafe / isBlockedHostname
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname) || parsed.hostname.includes(":")) {
    return { parsed, addresses: [parsed.hostname] };
  }

  let records;
  try {
    records = await dnsLookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    const err = new Error("DNS lookup failed for URL host");
    err.code = "SSRF_BLOCKED";
    err.status = 400;
    throw err;
  }

  const addresses = (records || []).map((r) => String(r.address || "").toLowerCase());
  if (!addresses.length) {
    const err = new Error("DNS lookup returned no addresses");
    err.code = "SSRF_BLOCKED";
    err.status = 400;
    throw err;
  }

  for (const addr of addresses) {
    if (isPrivateIpv4(addr) || isPrivateIpv6(addr) || addr === "169.254.169.254") {
      const err = new Error("URL resolves to a private or metadata address");
      err.code = "SSRF_BLOCKED";
      err.status = 400;
      throw err;
    }
  }

  return { parsed, addresses };
}

export function isPrivateOrMetadataAddress(addr) {
  const a = String(addr || "").toLowerCase();
  return isPrivateIpv4(a) || isPrivateIpv6(a) || a === "169.254.169.254";
}
