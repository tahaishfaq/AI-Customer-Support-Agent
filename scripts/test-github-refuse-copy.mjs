/**
 * Soften GitHub MCP refuse copy for embed vs studio.
 * Run: node --import ./scripts/register-aliases.mjs scripts/test-github-refuse-copy.mjs
 */
import assert from "node:assert/strict";
import {
  githubInventoryRefuseMessage,
  githubWriteRefuseMessage,
} from "../lib/orchestrator/github-refuse.js";

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

const writeFail = githubWriteRefuseMessage(
  [
    {
      name: "mcp_github_mcp_create_repository",
      errorCode: "MCP_TOOL_ERROR",
      bodyText: "[MCP error] name already exists on this account",
      _argsRaw: JSON.stringify({ name: "Harness_Agent", private: true }),
    },
  ],
  { publicAccess: false }
);
assert.match(writeFail, /already exists/i);
assert.match(writeFail, /Harness_Agent_2|Harness_Agent-v2/);
assert.match(writeFail, /Confirm/i);
assert.doesNotMatch(writeFail, /search_repositories|inventory/i);
assert.doesNotMatch(writeFail, /successfully created/i);

const writeFailNoName = githubWriteRefuseMessage(
  [
    {
      name: "mcp_github_mcp_create_repository",
      errorCode: "MCP_TOOL_ERROR",
      bodyText: "[MCP error] name already exists on this account",
    },
  ],
  { publicAccess: false }
);
assert.match(writeFailNoName, /already exists/i);
assert.match(writeFailNoName, /different repository name|new name/i);

const writeAuth = githubWriteRefuseMessage(
  [{ name: "mcp_github_mcp_create_repository", errorCode: "MCP_AUTH" }],
  { publicAccess: false }
);
assert.match(writeAuth, /authentication error|OAuth/i);

console.log("PASS  github refuse copy embed vs studio");
