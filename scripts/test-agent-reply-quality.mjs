/**
 * Agent reply-quality contract pack (Phase 0 + deferred roadmap wiring).
 * Run: npm run test:agent-reply-quality
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeSource } from "../lib/services/ai/source-policy.js";
import { detectCapabilityAsk } from "../lib/services/ai/intent-clarify.js";
import { githubInventoryRefuseMessage } from "../lib/orchestrator/github-refuse.js";
import { githubMcpAuthIssues } from "../lib/mcp/github-auth-status.js";
import { MAX_SYSTEM_PROMPT_CHARS } from "../lib/services/ai/prompt-builder.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// --- 1) Capability ask (no live MCP routing) ---
assert.equal(detectCapabilityAsk("do you have access to github"), true);
assert.equal(routeSource("do you have access to github").signals.wantsGithub, false);
assert.equal(routeSource("do you have access to github").signals.capabilityAsk, true);
assert.equal(routeSource("list my github repos").signals.wantsGithub, true);
assert.equal(routeSource("list my github repos").signals.capabilityAsk, false);
console.log("ok  capability ask routing");

// --- 2) Soft refuse embed vs studio ---
const auth = [{ errorCode: "MCP_AUTH" }];
assert.match(
  githubInventoryRefuseMessage(auth, { publicAccess: true }),
  /site owner|reconnect/i
);
assert.doesNotMatch(
  githubInventoryRefuseMessage(auth, { publicAccess: true }),
  /personal access token/i
);
assert.match(
  githubInventoryRefuseMessage(auth, { publicAccess: false }),
  /OAuth|personal access token/i
);
console.log("ok  soft refuse copy");

// --- 3) Studio / Tools auth banner helper ---
const issues = githubMcpAuthIssues([
  {
    id: "1",
    name: "GitHub MCP",
    url: "https://api.githubcopilot.com/mcp/",
    enabled: true,
    lastError: "HTTP 401 Unauthorized — token expired",
  },
  {
    id: "2",
    name: "Other",
    url: "https://example.com/mcp",
    enabled: true,
    lastError: "timeout",
  },
]);
assert.equal(issues.length, 1);
assert.equal(issues[0].name, "GitHub MCP");
assert.equal(githubMcpAuthIssues([{ name: "GitHub", lastError: null }]).length, 0);

const studio = read("components/studio/AgentTestStudio.jsx");
assert.match(studio, /githubMcpAuthIssues/);
assert.match(studio, /GitHub connection needs reconnect/);
assert.match(studio, /github-access/);
const mcpPanel = read("components/customization/McpServersPanel.jsx");
assert.match(mcpPanel, /githubMcpAuthIssues/);
assert.match(mcpPanel, /GitHub MCP authentication failed/);
console.log("ok  MCP auth banner wiring");

// --- 4) Refine system prompt wiring (no live OpenAI in CI) ---
const refineSvc = read("lib/services/refine-system-prompt.service.js");
assert.match(refineSvc, /REFINE_SYSTEM_META/);
assert.match(refineSvc, /Do NOT add/);
assert.match(refineSvc, /sanitizeSystemPromptOverlay/);
assert.match(refineSvc, /MAX_SYSTEM_PROMPT_CHARS/);
assert.match(refineSvc, /PROMPT_REQUIRED/);
assert.equal(MAX_SYSTEM_PROMPT_CHARS, 4000);
const form = read("components/agents/AgentForm.jsx");
assert.match(form, /Refine with AI/);
assert.match(form, /refineSystemPrompt/);
assert.match(form, /Accept/);
const route = read("app/api/agents/refine-system-prompt/route.js");
assert.match(route, /refineSystemPromptDraft/);
assert.match(route, /rateLimit/);
const api = read("lib/api/agents.js");
assert.match(api, /refine-system-prompt/);
console.log("ok  refine prompt wiring");

// --- turn-context strips GitHub MCP on capability ---
const turn = read("lib/services/ai/turn-context.js");
assert.match(turn, /capabilityAskSystemAddon/);
assert.match(turn, /isGithubMcpAction/);
assert.match(turn, /inferStickySourcePreference/);
console.log("ok  turn-context capability strip + sticky source");

console.log("\nPASS  agent reply quality pack");
