/**
 * One-shot runtime evidence for GitHub create / handoff filter path.
 * Writes NDJSON to debug ingest + .cursor/debug-10c523.log
 */
import fs from "node:fs";
import {
  routeSource,
  filterCapabilitiesForSourceRoute,
} from "../lib/services/ai/source-policy.js";
import {
  detectSourceAskSignals,
  detectGithubWriteFollowUp,
  filterActionsKnowledgeFirst,
  inferStickySourcePreference,
} from "../lib/services/ai/intent-clarify.js";

const LOG =
  "/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/.cursor/debug-10c523.log";
const INGEST =
  "http://127.0.0.1:7921/ingest/84e093c9-c14f-4ada-99a7-450980e35e0c";

function emit(hypothesisId, location, message, data) {
  const payload = {
    sessionId: "10c523",
    runId: "local-repro",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(LOG, `${JSON.stringify(payload)}\n`);
  fetch(INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "10c523",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

const catalog = [
  { name: "mcp_github_mcp_get_me", riskLevel: "READ", _mcp: true },
  {
    name: "mcp_github_mcp_create_repository",
    riskLevel: "WRITE",
    _mcp: true,
  },
  {
    name: "mcp_github_mcp_search_repositories",
    riskLevel: "READ",
    _mcp: true,
  },
  { name: "request_handoff", riskLevel: "READ", _builtin: { id: "request_handoff" } },
];

const createAsk =
  "use create_repository from github mcp and create a private repository named agents";
const followUp = "name: agents\nvisibility: private";

const d1 = routeSource(createAsk);
const after1 = filterCapabilitiesForSourceRoute(catalog, d1);
emit("H1", "repro-script:createAsk", "create ask after source-route filter", {
  utterance: createAsk,
  route: d1.route,
  wantsGithub: d1.signals.wantsGithub,
  afterNames: after1.map((a) => a.name),
  createAfter: after1.some((a) => /create_repositor/i.test(a.name)),
  strippedCreate:
    catalog.some((a) => /create_repositor/i.test(a.name)) &&
    !after1.some((a) => /create_repositor/i.test(a.name)),
});

const d2 = routeSource(followUp);
const sig2 = detectSourceAskSignals(followUp);
const writeFollowUp = detectGithubWriteFollowUp(followUp);
const sticky = inferStickySourcePreference(
  [
    { role: "USER", content: createAsk },
    {
      role: "ASSISTANT",
      content: "I found your GitHub username. Provide name and visibility.",
    },
  ].reverse(),
  { currentUtterance: followUp }
);
const decision2 =
  sticky === "github" && (sig2.inventoryAsk || writeFollowUp)
    ? {
        ...d2,
        signals: { ...d2.signals, wantsGithub: true },
      }
    : d2;
const afterKnowledge = filterActionsKnowledgeFirst(catalog, {
  usedKnowledgeCount: 2,
  wantsGithub: Boolean(decision2.signals?.wantsGithub),
  mayInvokeWebSearch: false,
  wantsWeb: false,
});
const after2 = filterCapabilitiesForSourceRoute(afterKnowledge, decision2);
emit("H2-H3", "repro-script:followUp", "follow-up after sticky+knowledge-first", {
  utterance: followUp,
  inventoryAsk: sig2.inventoryAsk,
  writeFollowUp,
  sticky,
  wantsGithubRaw: d2.signals.wantsGithub,
  wantsGithubAfterSticky: Boolean(decision2.signals?.wantsGithub),
  afterKnowledgeNames: afterKnowledge.map((a) => a.name),
  afterNames: after2.map((a) => a.name),
  createAfterFollowUp: after2.some((a) => /create_repositor/i.test(a.name)),
  onlyHandoff:
    after2.length > 0 &&
    after2.every(
      (a) =>
        String(a.name || "").toLowerCase() === "request_handoff" ||
        a?._builtin?.id === "request_handoff"
    ),
});

emit("post-fix", "repro-script:summary", "post-fix filter outcomes", {
  createAskKeepsCreate: after1.some((a) => /create_repositor/i.test(a.name)),
  followUpKeepsCreate: after2.some((a) => /create_repositor/i.test(a.name)),
  followUpOnlyHandoff:
    after2.length > 0 &&
    after2.every(
      (a) =>
        String(a.name || "").toLowerCase() === "request_handoff" ||
        a?._builtin?.id === "request_handoff"
    ),
});

console.log("wrote runtime evidence to debug-10c523.log");
