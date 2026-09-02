/**
 * F11-R5 seam — OAuth2 client-credentials token fetch (future credential type).
 * Not wired into ActionCredential yet; unit-testable helper only.
 */

/**
 * POST application/x-www-form-urlencoded to tokenUrl; return access_token.
 * @param {{ tokenUrl: string, clientId: string, clientSecret: string, scope?: string }} opts
 * @returns {Promise<{ access_token: string, token_type?: string, expires_in?: number, raw: object }>}
 */
export async function fetchClientCredentialsToken({
  tokenUrl,
  clientId,
  clientSecret,
  scope,
}) {
  if (!tokenUrl || !clientId || !clientSecret) {
    const err = new Error("tokenUrl, clientId, and clientSecret are required");
    err.status = 400;
    err.code = "OAUTH_INVALID";
    throw err;
  }

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  if (scope) body.set("scope", scope);

  const response = await fetch(String(tokenUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    redirect: "manual",
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const err = new Error("OAuth token endpoint returned non-JSON");
    err.status = 502;
    err.code = "OAUTH_BAD_RESPONSE";
    throw err;
  }

  if (!response.ok || !json.access_token) {
    const err = new Error(
      json.error_description || json.error || "OAuth token request failed"
    );
    err.status = response.status >= 400 ? response.status : 502;
    err.code = "OAUTH_TOKEN_FAILED";
    throw err;
  }

  return {
    access_token: String(json.access_token),
    token_type: json.token_type ? String(json.token_type) : undefined,
    expires_in:
      json.expires_in != null ? Number(json.expires_in) : undefined,
    raw: json,
  };
}
