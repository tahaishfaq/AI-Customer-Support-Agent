/**
 * M3 — GitHub MCP OAuth (no DCR) contracts.
 * Run: npm run test:mcp-github-oauth
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GITHUB_MCP_DEFAULT_URL,
  buildGithubAuthorizeUrl,
  getGithubMcpOauthConfig,
  signGithubMcpOauthState,
  verifyGithubMcpOauthState,
} from "../lib/mcp/github-oauth.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

process.env.AUTH_SECRET =
  process.env.AUTH_SECRET || "test-auth-secret-32chars-minimum!!";
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

assert.equal(GITHUB_MCP_DEFAULT_URL, "https://api.githubcopilot.com/mcp/");

const unconfigured = getGithubMcpOauthConfig();
assert.equal(typeof unconfigured.redirectUri, "string");
assert.match(unconfigured.redirectUri, /\/api\/mcp\/oauth\/github\/callback$/);
assert.ok(Array.isArray(unconfigured.missing));

process.env.GITHUB_MCP_OAUTH_CLIENT_ID = "test_client";
process.env.GITHUB_MCP_OAUTH_CLIENT_SECRET = "test_secret";
const configured = getGithubMcpOauthConfig();
assert.equal(configured.configured, true);
assert.equal(configured.clientId, "test_client");

const state = signGithubMcpOauthState({
  agentId: "agent_1",
  userId: "user_1",
  serverId: "srv_1",
});
const parsed = verifyGithubMcpOauthState(state);
assert.equal(parsed.agentId, "agent_1");
assert.equal(parsed.serverId, "srv_1");

assert.throws(() => verifyGithubMcpOauthState("bad.state"), /Invalid OAuth state/);

const authUrl = buildGithubAuthorizeUrl({
  clientId: "test_client",
  redirectUri: configured.redirectUri,
  state,
});
assert.match(authUrl, /github\.com\/login\/oauth\/authorize/);
assert.match(authUrl, /client_id=test_client/);
assert.match(authUrl, /scope=/);

const svc = read("lib/services/mcp-github-oauth.service.js");
assert.match(svc, /startGithubMcpOauthForAgent/);
assert.match(svc, /completeGithubMcpOauth/);
assert.match(svc, /dynamic client registration/i);

assert.ok(
  fs.existsSync(
    path.join(root, "app/api/agents/[id]/mcp-servers/github-oauth/route.js")
  )
);
assert.ok(
  fs.existsSync(
    path.join(root, "app/api/mcp/oauth/github/callback/route.js")
  )
);

const panel = read("components/customization/McpServersPanel.jsx");
assert.match(panel, /Connect with OAuth/);
assert.match(panel, /startGithubMcpOauth/);
assert.match(panel, /dynamic client registration/i);

const catalog = read("lib/mcp/catalog.js");
assert.match(catalog, /authHint:\s*"oauth"/);

console.log("mcp-github-oauth: ok");
