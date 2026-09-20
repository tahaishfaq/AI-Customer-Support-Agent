/**
 * Soften GitHub MCP refuse copy for embed vs studio.
 * Run: node --import ./scripts/register-aliases.mjs scripts/test-github-refuse-copy.mjs
 */
import assert from "node:assert/strict";
import { githubInventoryRefuseMessage } from "../lib/orchestrator/github-refuse.js";

const authStep = [{ errorCode: "MCP_AUTH" }];
const otherStep = [{ errorCode: "MCP_HTTP" }];

const studioAuth = githubInventoryRefuseMessage(authStep, { publicAccess: false });
assert.match(studioAuth, /OAuth|personal access token/i);
assert.match(studioAuth, /will not invent/i);

const embedAuth = githubInventoryRefuseMessage(authStep, { publicAccess: true });
assert.match(embedAuth, /site owner|reconnect/i);
assert.doesNotMatch(embedAuth, /personal access token/i);
assert.match(embedAuth, /will not invent/i);

const studioInv = githubInventoryRefuseMessage(otherStep, { publicAccess: false });
assert.match(studioInv, /search_repositories|MCP tools/i);

const embedInv = githubInventoryRefuseMessage([], { publicAccess: true });
assert.match(embedInv, /site owner|clearer request/i);
assert.doesNotMatch(embedInv, /search_repositories/);

console.log("PASS  github refuse copy embed vs studio");
