/**
 * Apply decrypted credential to HTTP headers (pure — no Prisma).
 * Brandly expects `X-API-KEY` (not Bearer JWT) for agent keys like `brnd_live_…`.
 * F14-C: optional end-user access token for requiresIdentity / USER-scoped calls.
 */

/**
 * Inject auth headers from decrypted credential + resolve {{credential:name}} refs.
 * @param {Record<string, string>} headers
 * @param {{ type?: string, headerName?: string|null, plaintext?: string, name?: string }|null} credential
 * @param {{
 *   credentialByName?: Record<string, { plaintext?: string }>,
 *   endUserAccessToken?: string|null,
 *   preferEndUserAuth?: boolean,
 * }} [opts]
 */
export function applyCredentialToHeaders(
  headers,
  credential,
  {
    credentialByName = {},
    endUserAccessToken = null,
    preferEndUserAuth = false,
  } = {}
) {
  const out = { ...(headers || {}) };

  for (const [key, raw] of Object.entries(out)) {
    out[key] = String(raw ?? "").replace(
      /\{\{\s*credential:([a-z][a-z0-9_]{0,63})\s*\}\}/gi,
      (_, name) => {
        const c = credentialByName[String(name).toLowerCase()];
        if (!c?.plaintext) {
          const err = new Error(`Missing credential: ${name}`);
          err.status = 400;
          err.code = "SCHEMA_INVALID";
          throw err;
        }
        return c.plaintext;
      }
    );
  }

  if (credential?.plaintext) {
    const plain = String(credential.plaintext);
    const type = String(credential.type || "BEARER").toUpperCase();
    const looksLikeBrandlyApiKey = /^brnd[_-]/i.test(plain);

    if (type === "API_KEY_HEADER" || looksLikeBrandlyApiKey) {
      const h =
        String(credential.headerName || "X-API-KEY").trim() || "X-API-KEY";
      out[h] = plain;
      // Node / Express header lookup is case-insensitive; set canonical too
      if (h.toLowerCase() !== "x-api-key") {
        out["X-API-KEY"] = plain;
      }
    } else if (!(preferEndUserAuth && endUserAccessToken)) {
      out.Authorization = `Bearer ${plain}`;
    }
  }

  // F14-C: user-scoped tools use the host end-user token, not the owner admin Bearer.
  if (preferEndUserAuth && endUserAccessToken) {
    out.Authorization = `Bearer ${String(endUserAccessToken).trim()}`;
  }

  return out;
}
