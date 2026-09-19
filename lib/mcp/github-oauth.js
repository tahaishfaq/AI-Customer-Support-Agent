/**
 * GitHub MCP OAuth (no Dynamic Client Registration).
 * GitHub's remote MCP rejects DCR — same wall Botpress hits.
 * Aide uses a pre-registered GitHub OAuth App (platform env) + classic authorize/code exchange.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GITHUB_MCP_DEFAULT_URL = "https://api.githubcopilot.com/mcp/";

/** Scopes covering common GitHub MCP toolsets (issues/PRs/repos). */
export const GITHUB_MCP_OAUTH_SCOPES = "repo read:org gist read:user";

const STATE_TTL_MS = 15 * 60 * 1000;

function appOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000";
  let origin = String(raw).replace(/\/$/, "");
  try {
    const u = new URL(origin.includes("://") ? origin : `http://${origin}`);
    if (u.hostname === "0.0.0.0" || u.hostname === "::") {
      u.hostname = "localhost";
    }
    origin = u.origin;
  } catch {
    origin = "http://localhost:3000";
  }
  return origin;
}

function signingKey() {
  const raw =
    process.env.ACTIONS_IDENTITY_SECRET ||
    process.env.AUTH_SECRET ||
    "";
  if (!raw || String(raw).length < 16) {
    const err = new Error(
      "ACTIONS_IDENTITY_SECRET or AUTH_SECRET required for MCP OAuth state"
    );
    err.status = 500;
    err.code = "OAUTH_STATE_KEY_MISSING";
    throw err;
  }
  return String(raw);
}

/**
 * @returns {{ configured: boolean, clientId: string|null, redirectUri: string, missing: string[] }}
 */
export function getGithubMcpOauthConfig() {
  const clientId = String(process.env.GITHUB_MCP_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = String(
    process.env.GITHUB_MCP_OAUTH_CLIENT_SECRET || ""
  ).trim();
  const redirectUri = `${appOrigin()}/api/mcp/oauth/github/callback`;
  const missing = [];
  if (!clientId) missing.push("GITHUB_MCP_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("GITHUB_MCP_OAUTH_CLIENT_SECRET");
  return {
    configured: missing.length === 0,
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    redirectUri,
    missing,
  };
}

/**
 * @param {{ agentId: string, userId: string, serverId: string, workspaceSlug?: string, nonce?: string }} payload
 */
export function signGithubMcpOauthState(payload) {
  const body = {
    agentId: String(payload.agentId),
    userId: String(payload.userId),
    serverId: String(payload.serverId),
    workspaceSlug: payload.workspaceSlug
      ? String(payload.workspaceSlug).slice(0, 64)
      : null,
    nonce: payload.nonce || randomBytes(8).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const json = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", signingKey())
    .update(json)
    .digest("base64url");
  return `${json}.${sig}`;
}

/**
 * @param {string} state
 * @returns {{ agentId: string, userId: string, serverId: string, nonce: string, exp: number }}
 */
export function verifyGithubMcpOauthState(state) {
  const raw = String(state || "");
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) {
    const err = new Error("Invalid OAuth state");
    err.status = 400;
    err.code = "OAUTH_STATE_INVALID";
    throw err;
  }
  const json = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac("sha256", signingKey())
    .update(json)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const err = new Error("Invalid OAuth state signature");
    err.status = 400;
    err.code = "OAUTH_STATE_INVALID";
    throw err;
  }
  let body;
  try {
    body = JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
  } catch {
    const err = new Error("Invalid OAuth state payload");
    err.status = 400;
    err.code = "OAUTH_STATE_INVALID";
    throw err;
  }
  if (!body?.agentId || !body?.userId || !body?.serverId || !body?.exp) {
    const err = new Error("Incomplete OAuth state");
    err.status = 400;
    err.code = "OAUTH_STATE_INVALID";
    throw err;
  }
  if (Date.now() > Number(body.exp)) {
    const err = new Error("OAuth state expired — start Connect again");
    err.status = 400;
    err.code = "OAUTH_STATE_EXPIRED";
    throw err;
  }
  return body;
}

/**
 * @param {{ clientId: string, redirectUri: string, state: string, scope?: string }} opts
 */
export function buildGithubAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  scope = GITHUB_MCP_OAUTH_SCOPES,
}) {
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", scope);
  u.searchParams.set("state", state);
  u.searchParams.set("allow_signup", "false");
  return u.toString();
}

/**
 * Exchange authorization code for access_token (no DCR).
 * @returns {Promise<{ access_token: string, scope?: string, token_type?: string }>}
 */
export async function exchangeGithubOAuthCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
}) {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    redirect: "manual",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    const err = new Error(
      json?.error_description ||
        json?.error ||
        "GitHub OAuth token exchange failed"
    );
    err.status = 400;
    err.code = "OAUTH_TOKEN_FAILED";
    throw err;
  }
  return {
    access_token: String(json.access_token),
    scope: json.scope ? String(json.scope) : undefined,
    token_type: json.token_type ? String(json.token_type) : undefined,
  };
}
