/**
 * Server bind create_repository name to visitor choice.
 * Run: node --import ./scripts/register-aliases.mjs scripts/test-github-create-name.mjs
 */
import assert from "node:assert/strict";
import {
  extractGithubRepoNameFromUtterance,
  extractOptionRepoName,
  enforceGithubCreateRepositoryArgs,
  isGithubCreateRepositoryAction,
  resolveGithubCreateRepoName,
} from "../lib/orchestrator/github-create-name.js";

assert.equal(
  extractGithubRepoNameFromUtterance(
    "create a private repository on my github named Harness_Agent"
  ),
  "Harness_Agent"
);
assert.equal(
  extractGithubRepoNameFromUtterance("Harness_Agent_2"),
  "Harness_Agent_2"
);
assert.equal(extractGithubRepoNameFromUtterance("hello"), null);

const assistant =
  'A repository named "Harness_Agent" already exists. Options: (1) Harness_Agent_2  (2) Harness_Agent-v2. Reply with 1, 2, or type a different name.';
assert.equal(extractOptionRepoName("1", assistant), "Harness_Agent_2");
assert.equal(extractOptionRepoName("2", assistant), "Harness_Agent-v2");
assert.equal(
  resolveGithubCreateRepoName({
    utterance: "1",
    recentAssistantText: assistant,
  }),
  "Harness_Agent_2"
);

const action = {
  name: "mcp_github_mcp_create_repository",
  _mcp: { remoteName: "create_repository" },
};
assert.equal(isGithubCreateRepositoryAction(action), true);

const coerced = enforceGithubCreateRepositoryArgs({
  action,
  args: { name: "Harness_Agent_Repo", private: true },
  lastUserMessage:
    "create a private repository on my github named Harness_Agent",
});
assert.equal(coerced.coerced, true);
assert.equal(coerced.args.name, "Harness_Agent");
assert.equal(coerced.previousName, "Harness_Agent_Repo");

const same = enforceGithubCreateRepositoryArgs({
  action,
  args: { name: "Harness_Agent", private: true },
  lastUserMessage:
    "create a private repository on my github named Harness_Agent",
});
assert.equal(same.coerced, false);
assert.equal(same.args.name, "Harness_Agent");

const follow = enforceGithubCreateRepositoryArgs({
  action,
  args: { name: "Wrong", private: true },
  lastUserMessage: "1",
  recentAssistantText: assistant,
});
assert.equal(follow.coerced, true);
assert.equal(follow.args.name, "Harness_Agent_2");

const other = enforceGithubCreateRepositoryArgs({
  action: { name: "mcp_github_mcp_get_me", _mcp: { remoteName: "get_me" } },
  args: { name: "x" },
  lastUserMessage: "named Harness_Agent",
});
assert.equal(other.coerced, false);

console.log("PASS  github create name binding");
