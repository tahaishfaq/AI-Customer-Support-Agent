/**
 * Source clarify + sticky source + knowledge-first smoke.
 * Run: node --import ./scripts/register-aliases.mjs scripts/test-intent-clarify.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectCapabilityAsk,
  detectSourceAmbiguity,
  detectSourceAskSignals,
  filterActionsKnowledgeFirst,
  formatSourceClarifyQuestion,
  inferStickySourcePreference,
  resolveSourceClarifyReply,
  sourceClarifyButtonsFromContent,
} from "../lib/services/ai/intent-clarify.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const bareRepos = detectSourceAmbiguity({
  utterance: "show repositories",
  hasGithubMcp: true,
  webSearchEnabled: true,
  hasKnowledgeHit: false,
});
assert.ok(bareRepos);
assert.deepEqual(bareRepos.options.sort(), ["github", "web"]);

const explicit = detectSourceAmbiguity({
  utterance: "show my github repositories",
  hasGithubMcp: true,
  webSearchEnabled: true,
});
assert.equal(explicit, null, "explicit github skips clarify");

const webOff = detectSourceAmbiguity({
  utterance: "list repos",
  hasGithubMcp: true,
  webSearchEnabled: false,
});
assert.equal(webOff, null, "single source skips clarify");

const q = formatSourceClarifyQuestion(["github", "web"]);
assert.match(q, /Where should I look/);
assert.match(q, /1\.\s+\*\*Connected GitHub\*\*/);
assert.match(q, /2\.\s+\*\*Web search\*\*/);
assert.match(q, /Reply with a number/);

const resolved = resolveSourceClarifyReply("Connected GitHub", [
  {
    role: "ASSISTANT",
    content: formatSourceClarifyQuestion(["github", "web"]),
  },
  { role: "USER", content: "show repositories" },
]);
assert.equal(resolved?.preference, "github");
assert.match(resolved.rewritten, /connected GitHub/i);

const byNumber = resolveSourceClarifyReply("1", [
  {
    role: "ASSISTANT",
    content: formatSourceClarifyQuestion(["github", "web"]),
  },
  { role: "USER", content: "show repositories" },
]);
assert.equal(byNumber?.preference, "github");

const byNumberTwo = resolveSourceClarifyReply("2", [
  {
    role: "ASSISTANT",
    content: formatSourceClarifyQuestion(["github", "web"]),
  },
  { role: "USER", content: "show repositories" },
]);
assert.equal(byNumberTwo?.preference, "web");

const explicitWebSignals = detectSourceAskSignals(
  "search on Web for highest-star design repos"
);
assert.equal(explicitWebSignals.explicitWeb, true);
assert.equal(
  detectSourceAmbiguity({
    utterance: "search on Web for highest-star design repos",
    hasGithubMcp: true,
    webSearchEnabled: true,
  }),
  null,
  "explicit web + repo skips clarify"
);

const buttons = sourceClarifyButtonsFromContent(
  formatSourceClarifyQuestion(["github", "web", "knowledge"])
);
assert.equal(buttons.length, 3);
assert.equal(buttons[0].label, "Connected GitHub");
assert.equal(buttons[1].label, "Web search");
const byButton = resolveSourceClarifyReply(buttons[0].label, [
  {
    role: "ASSISTANT",
    content: formatSourceClarifyQuestion(["github", "web"]),
  },
  { role: "USER", content: "show repositories" },
]);
assert.equal(byButton?.preference, "github");

const signals = detectSourceAskSignals("get my Gtihub Profile");
assert.equal(signals.explicitGithub, true);

assert.equal(detectCapabilityAsk("do you have access to github"), true);
assert.equal(detectCapabilityAsk("list my github repos"), false);
assert.equal(
  detectCapabilityAsk("can you list my github repositories"),
  false,
  "inventory verbs beat capability"
);

// Sticky source: prior GitHub turn → follow-up list repos skips clarify.
const followUpPrompt = "list first 5 repos with their name url";
const stickyHistory = [
  { role: "USER", content: followUpPrompt },
  {
    role: "ASSISTANT",
    content:
      "Yes, I accessed your GitHub profile. Username: RanaSamiaAfzal. Sources: Connected GitHub",
  },
  { role: "USER", content: "Did you acces to my github" },
];
assert.equal(
  inferStickySourcePreference(stickyHistory, {
    currentUtterance: followUpPrompt,
  }),
  "github"
);
assert.equal(
  detectSourceAmbiguity({
    utterance: followUpPrompt,
    hasGithubMcp: true,
    webSearchEnabled: true,
    stickyPreference: "github",
  }),
  null,
  "sticky github skips clarify on bare list repos"
);

assert.equal(
  inferStickySourcePreference([{ role: "USER", content: "list repos" }], {
    currentUtterance: "list repos",
  }),
  null,
  "cold inventory has no sticky"
);
assert.ok(
  detectSourceAmbiguity({
    utterance: "list repos",
    hasGithubMcp: true,
    webSearchEnabled: true,
    stickyPreference: null,
  }),
  "cold list repos still clarifies"
);

const stripped = filterActionsKnowledgeFirst(
  [
    { name: "mcp_github_mcp_get_me", _mcp: {} },
    { name: "request_handoff", _builtin: { id: "request_handoff" } },
  ],
  {
    usedKnowledgeCount: 2,
    wantsGithub: false,
    mayInvokeWebSearch: false,
    wantsWeb: false,
  }
);
assert.equal(stripped.length, 1);
assert.equal(stripped[0].name, "request_handoff");

const chat = fs.readFileSync(
  path.join(root, "lib/services/chat.service.js"),
  "utf8"
);
assert.match(chat, /sourceClarify/);
assert.doesNotMatch(chat, /response-preparation/);

const turn = fs.readFileSync(
  path.join(root, "lib/services/ai/turn-context.js"),
  "utf8"
);
assert.match(turn, /inferStickySourcePreference/);
assert.match(turn, /stickyPreference/);

const list = fs.readFileSync(
  path.join(root, "components/chat/MessageList.jsx"),
  "utf8"
);
assert.doesNotMatch(list, /Working on your request/);
assert.match(list, /onSourceClarifyReply/);

const bubble = fs.readFileSync(
  path.join(root, "components/chat/MessageBubble.jsx"),
  "utf8"
);
assert.match(bubble, /sourceClarifyButtonsFromContent/);
assert.match(bubble, /Choose where to look/);

console.log(
  "PASS  intent clarify + sticky source + knowledge-first + activity UX wiring"
);
