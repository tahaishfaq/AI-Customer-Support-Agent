/**
 * GitHub MCP profile / inventory routing smoke + capability-ask (no live MCP).
 * Run: node --import ./scripts/register-aliases.mjs scripts/test-github-mcp-profile-route.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  capabilityAskSystemAddon,
  filterCapabilitiesForSourceRoute,
  isGithubMcpAction,
  routeSource,
} from "../lib/services/ai/source-policy.js";
import { detectCapabilityAsk } from "../lib/services/ai/intent-clarify.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const loop = fs.readFileSync(
  path.join(root, "lib/orchestrator/loop.js"),
  "utf8"
);
const turnCtx = fs.readFileSync(
  path.join(root, "lib/services/ai/turn-context.js"),
  "utf8"
);

const profile = routeSource("get my Github Profile");
assert.equal(profile.signals.wantsGithub, true);
assert.equal(profile.signals.capabilityAsk, false);
assert.ok(!profile.entities.includes("ACCOUNT"), "github profile ≠ ACCOUNT");

const typo = routeSource("get my Gtihub Profile");
assert.equal(typo.signals.wantsGithub, true, "typo gtihub still GitHub");
assert.ok(!typo.entities.includes("ACCOUNT"));

const userAsk = routeSource("show my github user");
assert.equal(userAsk.signals.wantsGithub, true);

// Capability / confirmation — config only, no inventory tools.
for (const q of [
  "did you have acces to github",
  "do you have access to github",
  "Do you have GitHub access?",
  "are you connected to github",
  "can you access github",
]) {
  assert.equal(detectCapabilityAsk(q), true, `capability: ${q}`);
  const d = routeSource(q);
  assert.equal(d.signals.capabilityAsk, true, `capabilityAsk: ${q}`);
  assert.equal(d.signals.wantsGithub, false, `no wantsGithub: ${q}`);
}

const inventory = routeSource("list my github repos");
assert.equal(inventory.signals.capabilityAsk, false);
assert.equal(inventory.signals.wantsGithub, true, "inventory still GitHub");

const createAsk = routeSource(
  "create a private repository on my github named agents"
);
assert.equal(createAsk.signals.wantsGithub, true);
const createFiltered = filterCapabilitiesForSourceRoute(
  [
    { name: "mcp_github_mcp_get_me", riskLevel: "READ" },
    { name: "mcp_github_mcp_create_repository", riskLevel: "WRITE" },
    { name: "request_handoff", riskLevel: "READ" },
  ],
  createAsk
);
assert.ok(
  createFiltered.some((a) => /create_repositor/i.test(a.name)),
  "wantsGithub keeps GitHub WRITE create_repository"
);

const canList = routeSource("can you list my github repositories");
assert.equal(canList.signals.capabilityAsk, false, "inventory verbs win");
assert.equal(canList.signals.wantsGithub, true);

const addonYes = capabilityAskSystemAddon({
  connected: true,
  toolNames: ["mcp_github_mcp_get_me", "mcp_github_mcp_search_repositories"],
});
assert.match(addonYes, /Capability check/);
assert.match(addonYes, /Do NOT call any tools/);
assert.match(addonYes, /mcp_github_mcp_get_me/);

const addonNo = capabilityAskSystemAddon({ connected: false, toolNames: [] });
assert.match(addonNo, /No GitHub MCP tools/);

assert.equal(
  isGithubMcpAction({ _mcp: true, name: "mcp_github_mcp_get_me" }),
  true
);
assert.equal(isGithubMcpAction({ _mcp: true, name: "mcp_other_x" }), false);
assert.equal(isGithubMcpAction({ name: "mcp_github_mcp_get_me" }), false);

assert.match(turnCtx, /capabilityAskSystemAddon/, "turn injects capability addon");
assert.match(turnCtx, /isGithubMcpAction/, "turn strips GitHub MCP on capability");

assert.match(loop, /name\.includes\("github"\)/, "any github MCP success counts");
assert.match(loop, /get_me/, "get_me in inventory pattern");
assert.match(loop, /GITHUB_REPO_LIST_NAME/, "repo-list tools gated separately");
assert.match(loop, /userAskedForRepoList/, "repo-list utterance detection");
assert.match(loop, /userAskedForGithubWrite/, "create asks excluded from list gate");
assert.match(
  loop,
  /did not complete the repository write/,
  "write-failure copy distinct from list refuse"
);
assert.match(
  loop,
  /Previous tools did not return a repository list/,
  "nudge when wrong tools used for repo list"
);
assert.match(
  loop,
  /must call an enabled GitHub MCP tool/,
  "nudge when model skips tools"
);
assert.match(
  loop,
  /stopReason !== "needs_user"/,
  "pending confirm is not inventory refuse"
);

const policy = fs.readFileSync(
  path.join(root, "lib/services/ai/source-policy.js"),
  "utf8"
);
assert.match(
  policy,
  /MUST call search_repositories/,
  "system addon forbids releases/collaborators for repo lists"
);
assert.match(policy, /not list_releases/, "explicit anti-pattern in addon");

console.log("PASS  github mcp profile route + capability ask");
