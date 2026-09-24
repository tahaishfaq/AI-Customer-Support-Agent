/**
 * Per-turn tool shortlist: MCP only when relevant, capped, never from an auth-failed server.
 * Run: node --test scripts/test-tool-shortlist.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { relevantToolNames, shortlistToolsForTurn } from "../lib/services/ai/tool-shortlist.js";

const http = (name, description) => ({ name, description, riskLevel: "READ" });
const gh = (remoteName, description, extra = {}) => ({
  name: `mcp_github_mcp_${remoteName}`,
  description,
  riskLevel: "READ",
  _mcp: { remoteName, url: "https://api.githubcopilot.com/mcp/", ...extra },
});
const builtin = { name: "request_handoff", description: "Hand off to a human", _builtin: { id: "request_handoff" } };
const brandly = [
  http("search_brandly_help", "Search Brandly demo help articles by keyword (escrow, payout, matching, dispute, profile)."),
  http("list_brandly_plans", "List Brandly demo plan/catalog items and prices."),
];
const github = [
  gh("get_me", "Get details of the authenticated GitHub user"),
  gh("search_repositories", "Search for GitHub repositories"),
  gh("list_issues", "List issues in a GitHub repository"),
  gh("merge_pull_request", "Merge a pull request in a GitHub repository", {}),
  ...Array.from({ length: 40 }, (_, i) => gh(`extra_repository_tool_${i}`, "Another GitHub repository tool")),
];

test("non-GitHub question offers no GitHub MCP tools; HTTP and builtins always stay", () => {
  const names = shortlistToolsForTurn([...brandly, builtin, ...github], { utterance: "How do escrow payouts work?" }).map((a) => a.name);
  assert.deepEqual(names, ["search_brandly_help", "list_brandly_plans", "request_handoff"]);
});

test("GitHub ask offers core inventory tools first and caps MCP at 12", () => {
  const offered = shortlistToolsForTurn([...brandly, ...github], { utterance: "List my GitHub repositories", wantsGithub: true });
  const mcp = offered.filter((a) => a._mcp);
  assert.equal(mcp.length, 12);
  assert.deepEqual(mcp.slice(0, 2).map((a) => a._mcp.remoteName).sort(), ["get_me", "search_repositories"]);
  assert.equal(offered.filter((a) => !a._mcp).length, 2);
});

test("auth-failed MCP server: hidden, except get_me on a direct GitHub ask", () => {
  const broken = github.map((tool) => ({ ...tool, _mcp: { ...tool._mcp, authFailed: true } }));
  const asked = shortlistToolsForTurn([...brandly, ...broken], { utterance: "List my GitHub repositories", wantsGithub: true });
  assert.deepEqual(asked.filter((a) => a._mcp).map((a) => a._mcp.remoteName), ["get_me"]);
  const other = shortlistToolsForTurn([...brandly, ...broken], { utterance: "list repository issues" });
  assert.equal(other.filter((a) => a._mcp).length, 0);
});

test("relevant READ tools are named for the prompt hint", () => {
  assert.deepEqual(relevantToolNames([...brandly, builtin], "How do escrow payouts work?"), ["search_brandly_help"]);
  assert.deepEqual(relevantToolNames([...brandly, builtin], "Hi there!"), []);
  assert.deepEqual(relevantToolNames([{ ...brandly[0], riskLevel: "WRITE" }], "escrow payout"), []);
});
