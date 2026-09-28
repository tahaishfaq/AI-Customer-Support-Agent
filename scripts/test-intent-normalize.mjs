/**
 * B1 — typo-tolerant source routing, short follow-ups, and follow-up tool matching.
 * Run: npm run test:intent-normalize
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  correctIntentToken,
  isFollowUpReference,
  normalizeIntentTypos,
} from "../lib/services/ai/intent-normalize.js";
import { routeSource } from "../lib/services/ai/source-policy.js";
import {
  detectCapabilityAsk,
  detectSourceAskSignals,
  findSourceRequestUtterance,
  inferStickySourcePreference,
} from "../lib/services/ai/intent-clarify.js";
import { relevantToolNames, shortlistToolsForTurn } from "../lib/services/ai/tool-shortlist.js";

const mcp = (remoteName, description) => ({
  name: `mcp_github_mcp_${remoteName}`,
  description,
  riskLevel: "READ",
  _mcp: { remoteName, url: "https://api.githubcopilot.com/mcp/" },
});
/** Realistic slice of the GitHub MCP catalogue (45 tools on the real agent). */
const GITHUB_TOOLS = [
  mcp("get_me", "Get details of the authenticated GitHub user"),
  mcp("search_repositories", "Find GitHub repositories by name, description, readme, topics or other metadata"),
  mcp("list_branches", "List branches in a GitHub repository"),
  mcp("list_releases", "List releases in a GitHub repository"),
  mcp("list_issues", "List issues in a GitHub repository"),
  mcp("list_issue_types", "List supported issue types for repository owner"),
  mcp("list_issue_fields", "List issue fields for a repository"),
  mcp("list_tags", "List git tags in a GitHub repository"),
  mcp("list_commits", "Get list of commits of a branch in a GitHub repository"),
  mcp("list_pull_requests", "List pull requests in a GitHub repository"),
  mcp("list_repository_collaborators", "List collaborators of a repository"),
  mcp("add_issue_comment", "Add a comment to a specific issue in a GitHub repository"),
  mcp("get_file_contents", "Get the contents of a file or directory from a GitHub repository"),
  mcp("search_code", "Fast and precise code search across ALL GitHub repositories"),
];
const remote = (list) => list.map((a) => a._mcp.remoteName);

test("near-miss source words are corrected; real neighbours are not", () => {
  for (const typo of ["repositores", "repsitories", "repositry", "reposotory", "repostories"]) {
    assert.ok(["repository", "repositories"].includes(correctIntentToken(typo)), typo);
  }
  for (const typo of ["gihtub", "githbu", "guthub", "githib"]) assert.equal(correctIntentToken(typo), "github", typo);
  for (const word of ["report", "repost", "reposts", "repositioning", "issued", "tissue", "comments", "gitlab", "history", "registry", "repeat"]) {
    assert.equal(correctIntentToken(word), null, word);
  }
  assert.equal(correctIntentToken("github"), null, "exact word is left alone");
  assert.equal(normalizeIntentTypos("Can you tell how may REPOSITORES i ahve"), "can you tell how may repositories i ahve");
  assert.equal(normalizeIntentTypos("see github.io docs"), "see github.io docs");
  assert.equal(normalizeIntentTypos("میرا آرڈر کہاں ہے"), "میرا آرڈر کہاں ہے", "Urdu script untouched");
  assert.equal(normalizeIntentTypos(""), "");
  assert.equal(normalizeIntentTypos(null), "");
});

test("typo'd GitHub asks now route to GitHub (the screenshot messages)", () => {
  for (const message of [
    "Can you tell how may repositores i ahve",
    "can you list all my repsitories here ??",
    "show me the repositores those are not mine but i have been added into that",
    "show my gihtub profile",
  ]) {
    assert.equal(routeSource(message).signals.wantsGithub, true, message);
    assert.equal(routeSource(message).route, "GENERAL", message);
  }
  // Unchanged: capability asks never offer live tools; plain store asks stay STORE.
  assert.equal(detectCapabilityAsk("do you have access to github"), true);
  assert.equal(routeSource("do you have access to github").signals.wantsGithub, false);
  assert.equal(routeSource("I need a report of my orders").signals.wantsGithub, false);
  assert.equal(routeSource("Ap ke latest plans kya hain?").route, "STORE");
});

test("follow-up references: continuations yes, ordinary sentences no", () => {
  for (const message of ["list all of them", "show the rest", "more", "next batch", "and the others?", "list them all", "show me all", "give me the remaining ones", "full list please"]) {
    assert.equal(isFollowUpReference(message), true, message);
  }
  for (const message of ["tell them I'm unhappy", "is it free?", "thanks", "ok", "", "what are your plans", "show me all your pricing plans and their features and limits in detail please"]) {
    assert.equal(isFollowUpReference(message), false, message);
  }
});

test("the earlier request a follow-up refers to is found (newest first, current skipped)", () => {
  const history = [
    { role: "USER", content: "list all of them" },
    { role: "ASSISTANT", content: "You have a total of 17 repositories on GitHub. Here are some of them…" },
    { role: "USER", content: "list ll my repository ?" },
    { role: "ASSISTANT", content: "Yes, I have access to GitHub tools configured for this agent." },
    { role: "USER", content: "do you have access to github" },
  ];
  assert.equal(inferStickySourcePreference(history, { currentUtterance: "list all of them" }), "github");
  assert.equal(findSourceRequestUtterance(history, "github", "list all of them"), "list ll my repository ?");
  assert.equal(findSourceRequestUtterance(history, "web", "list all of them"), "");
  assert.equal(findSourceRequestUtterance([], "github", "x"), "");
  assert.equal(findSourceRequestUtterance(null, "github", "x"), "");
});

test("follow-up keeps search_repositories offered and first in the hint", () => {
  const followUp = shortlistToolsForTurn(GITHUB_TOOLS, {
    utterance: "list all of them",
    carryUtterance: "list ll my repository ?",
    wantsGithub: true,
  });
  assert.ok(remote(followUp).includes("search_repositories"));
  assert.ok(remote(followUp).includes("get_me"));
  // Before: the follow-up alone scored only list_* tools and dropped search_repositories.
  const alone = shortlistToolsForTurn(GITHUB_TOOLS, { utterance: "list all of them", wantsGithub: false });
  assert.ok(!remote(alone).includes("search_repositories"));
  // The prompt hint names the repository tool first, not list_branches / list_releases.
  assert.equal(relevantToolNames(GITHUB_TOOLS, "list ll my repository ? list all of them")[0], "mcp_github_mcp_search_repositories");
});

test("typo'd ask offers search_repositories without any carry", () => {
  const offered = shortlistToolsForTurn(GITHUB_TOOLS, {
    utterance: "can you list all my repsitories here ??",
    wantsGithub: routeSource("can you list all my repsitories here ??").signals.wantsGithub,
  });
  assert.ok(remote(offered).includes("search_repositories"));
  assert.equal(detectSourceAskSignals("how may repositores i ahve").inventoryAsk, true);
  // "repos" is the same noun as the tool's "repositories".
  assert.equal(relevantToolNames(GITHUB_TOOLS, "show my repos")[0], "mcp_github_mcp_search_repositories");
});
