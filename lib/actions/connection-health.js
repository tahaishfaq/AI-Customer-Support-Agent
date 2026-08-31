/**
 * F11 UX-3 — Plain-language connection health messages for owners.
 * Client-safe (no Prisma / Node-only deps).
 */

export const CONN_MSG = Object.freeze({
  NEED_KEY: "Add an API key first.",
  OK: "Connected — your key works with this system.",
  OK_BRANDLY: "Connected — your key works with Brandly.",
  INVALID_KEY:
    "Key invalid or revoked in your system. Paste a new key, then revoke the old one.",
  FORBIDDEN: "This key doesn’t have permission for that lookup.",
  NOT_FOUND:
    "Key may be fine, but the test URL wasn’t found. Check Capabilities or Advanced.",
  TIMEOUT: "Your system timed out. Try again in a moment.",
  NETWORK: "Couldn’t reach your system. Check that it’s online, then retry.",
  GENERIC: "Connection failed — try again.",
  PREPARE_FAILED:
    "Couldn’t prepare a connection test. Open Capabilities and turn on List campaigns.",
});

/**
 * Map executor / HTTP failures to owner-facing copy (UX-3).
 * @param {Error | null} err
 * @param {object | null} result — executeHttpAction-style result
 */
export function friendlyConnectionError(err, result) {
  const status = Number(result?.httpStatus ?? err?.status);
  const code = String(result?.errorCode || result?.status || err?.code || "");
  const body = String(result?.bodyText || err?.message || "");

  if (
    status === 401 ||
    code === "CREDENTIAL_REVOKED" ||
    code === "CREDENTIAL_MISSING" ||
    /unauthorized|invalid.?key|api.?key|revoked|forbidden.?key/i.test(body)
  ) {
    return CONN_MSG.INVALID_KEY;
  }
  if (status === 403) {
    return CONN_MSG.FORBIDDEN;
  }
  if (status === 404) {
    return CONN_MSG.NOT_FOUND;
  }
  if (
    code === "TIMEOUT" ||
    result?.status === "TIMEOUT" ||
    /timeout/i.test(body)
  ) {
    return CONN_MSG.TIMEOUT;
  }
  if (
    code === "FETCH_ERROR" ||
    code === "SSRF_BLOCKED" ||
    /fetch failed|econnrefused|enotfound|network/i.test(body)
  ) {
    return CONN_MSG.NETWORK;
  }
  if (!result?.ok && body && body.length <= 160 && !/casterror|mongo|stack/i.test(body)) {
    return body;
  }
  if (err?.message && !/casterror|mongo|stack/i.test(err.message)) {
    return err.message.length > 160
      ? `${err.message.slice(0, 160)}…`
      : err.message;
  }
  return CONN_MSG.GENERIC;
}

export function connectionHealthTitle(connStatus) {
  if (!connStatus) return "Not tested";
  if (connStatus.ok) return "Connected";
  return "Not connected";
}
