/**
 * Stage 5.5 — Deterministic source router tests.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage5-5.5-source-router.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const {
  SOURCE_ROUTES,
  classifySourceIntent,
  mayInvokeWebSearch,
  requiredSourceFamily,
  routeSource,
  filterCapabilitiesForSourceRoute,
  sourceRouteSystemAddon,
  applySourceRouteToSystem,
  RESPONSE_RULES_STORE_FACTS,
} = await import("../lib/services/ai/source-policy.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "5.5", ...row });
}
function pass(id, evidence, actual = {}) {
  record({ id, status: "PASS", evidence, actual });
}
function fail(id, evidence, actual = {}) {
  record({ id, status: "FAIL", evidence, actual });
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// Canonical matrix: utterance → route / mayWeb / family / intent
const matrix = [
  ["Is Nike Air Max 90 in stock at my store?", "STORE", false, "STORE", "STORE_FACT"],
  ["What is the price of Nike Air Max 90 in my store?", "STORE", false, "STORE", "STORE_FACT"],
  ["What is my order status?", "STORE", false, "STORE", "STORE_FACT"],
  ["Do you carry size 10?", "STORE", false, "STORE", "STORE_FACT"],
  ["What is REST?", "GENERAL", false, "PUBLIC", "PUBLIC_KNOWLEDGE"],
  ["What is photosynthesis?", "GENERAL", false, "PUBLIC", "PUBLIC_KNOWLEDGE"],
  ["Explain how OAuth works", "GENERAL", false, "PUBLIC", "PUBLIC_KNOWLEDGE"],
  ["Search the internet for current events about AI", "WEB", true, "WEB", "WEB_REQUEST"],
  ["Search online for today's news headlines", "WEB", true, "WEB", "WEB_REQUEST"],
  ["Compare my store price with online prices", "MIXED", true, "MIXED", "MIXED"],
  ["Search online whether Nike Air Max 90 is available", "MIXED", true, "MIXED", "MIXED"],
];

let matrixOk = true;
for (const [utterance, route, mayWeb, family, intent] of matrix) {
  const d = routeSource(utterance);
  const gotI = classifySourceIntent(utterance);
  const gotW = mayInvokeWebSearch(utterance);
  const gotF = requiredSourceFamily(utterance);
  const ok =
    d.route === route &&
    d.mayInvokeWebSearch === mayWeb &&
    gotW === mayWeb &&
    gotF === family &&
    gotI === intent &&
    d.allowParametricKnowledge === (route !== "STORE");
  if (!ok) matrixOk = false;
  record({
    id: `S5.5-MATRIX-${route}-${utterance.slice(0, 22).replace(/\W+/g, "_")}`,
    status: ok ? "PASS" : "FAIL",
    evidence: "routeSource + legacy classifiers",
    input: utterance,
    expected: { route, mayWeb, family, intent },
    actual: {
      route: d.route,
      mayWeb: d.mayInvokeWebSearch,
      family: gotF,
      intent: gotI,
      allowParametric: d.allowParametricKnowledge,
    },
  });
}
if (matrixOk) {
  pass("S5.5-MATRIX-ALL", "All canonical STORE/WEB/GENERAL/MIXED cases match");
}

// Tool strip: STORE removes web_search; WEB keeps it
{
  const caps = [
    { name: "get_order" },
    { name: "web_search" },
    { name: "handoff" },
  ];
  const store = filterCapabilitiesForSourceRoute(
    caps,
    routeSource("Is the blue hoodie in stock?")
  );
  const web = filterCapabilitiesForSourceRoute(
    caps,
    routeSource("Search the internet for AI news")
  );
  const storeNames = store.map((c) => c.name);
  const webNames = web.map((c) => c.name);
  if (
    !storeNames.includes("web_search") &&
    storeNames.includes("get_order") &&
    webNames.includes("web_search")
  ) {
    pass(
      "S5.5-FILTER-TOOLS",
      "STORE strips web_search from offered tools; WEB keeps it"
    );
  } else {
    fail("S5.5-FILTER-TOOLS", "Capability filter wrong", { storeNames, webNames });
  }
}

// System addon
{
  const storeAddon = sourceRouteSystemAddon(routeSource("What is the price?"));
  const genAddon = sourceRouteSystemAddon(routeSource("What is REST?"));
  const applied = applySourceRouteToSystem("base prompt", routeSource("in stock?"));
  if (
    /Source route \(server\): STORE/.test(storeAddon) &&
    /Do not call web_search/.test(storeAddon) &&
    /GENERAL/.test(genAddon) &&
    /Source route \(server\): STORE/.test(applied)
  ) {
    pass("S5.5-PROMPT-ADDON", "Turn-level SOURCE route directives present");
  } else {
    fail("S5.5-PROMPT-ADDON", "Missing route directives", { storeAddon, genAddon });
  }
}

// STORE forbids parametric; GENERAL allows
{
  const s = routeSource("shipping ETA for my order");
  const g = routeSource("How does photosynthesis work?");
  if (!s.allowParametricKnowledge && g.allowParametricKnowledge && s.preferAgentKnowledge) {
    pass(
      "S5.5-PARAMETRIC",
      "STORE disallowParametric; GENERAL allow; STORE preferAgentKnowledge"
    );
  } else {
    fail("S5.5-PARAMETRIC", "Parametric flags wrong", { s, g });
  }
}

// Wiring present
{
  const loop = read("lib/orchestrator/loop.js");
  const chat = read("lib/services/chat.service.js");
  const builtin = read("lib/capabilities/adapters/builtin.adapter.js");
  const wired =
    /filterCapabilitiesForSourceRoute/.test(loop) &&
    /routeSource/.test(loop) &&
    /applySourceRouteToSystem/.test(chat) &&
    /STORE_SOURCE_REQUIRED/.test(builtin) &&
    /mayInvokeWebSearch/.test(builtin) &&
    !/fallbackToWeb|autoWebSearch/.test(loop);
  if (wired) {
    pass(
      "S5.5-WIRED",
      "Orchestrator strips tools; chat applies route prompt; PEP retained; no auto-web fallback"
    );
  } else {
    fail("S5.5-WIRED", "Missing wiring");
  }
}

// SOURCE_ROUTES constants
{
  const keys = Object.values(SOURCE_ROUTES).sort().join(",");
  if (keys === "GENERAL,MIXED,STORE,WEB" && /STORE FACTS/i.test(RESPONSE_RULES_STORE_FACTS)) {
    pass("S5.5-CONSTANTS", "SOURCE_ROUTES = STORE/WEB/GENERAL/MIXED");
  } else {
    fail("S5.5-CONSTANTS", "Constants mismatch", { keys });
  }
}

// webSearchEnabled:false forces mayWeb false even on WEB ask
{
  const d = routeSource("Search the internet for news", { webSearchEnabled: false });
  if (!d.mayInvokeWebSearch && d.route === "WEB") {
    pass(
      "S5.5-FLAG-OFF",
      "Agent webSearchEnabled=false forces mayInvokeWebSearch=false"
    );
  } else {
    fail("S5.5-FLAG-OFF", "Flag gate wrong", d);
  }
}

fs.mkdirSync(outDir, { recursive: true });
const failures = results.filter((r) => r.status === "FAIL");
const report = `# Stage 5.5 — Source Router

Generated: ${new Date().toISOString()}

## Verdict: **${failures.length ? "FAIL" : "PASS"}**

| PASS | FAIL | TOTAL |
| ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.length} |

## Routes

\`\`\`text
STORE   — store facts only (knowledge/tools); web_search stripped + PEP
WEB     — explicit online ask; web_search allowed
GENERAL — public/conceptual; no web tool; parametric OK (not store facts)
MIXED   — store + online compare; both allowed, labeled separately
\`\`\`

## Hardening

- Canonical \`routeSource()\` (+ \`SOURCE_ROUTES\`)
- \`filterCapabilitiesForSourceRoute\` — LLM never sees \`web_search\` on STORE/GENERAL
- Turn-level \`## Source route (server)\` system addon
- Chat + orchestrator wired; builtin \`STORE_SOURCE_REQUIRED\` PEP retained
- No empty-store → web auto-fallback

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}${r.input ? ` — _${r.input}_` : ""}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${JSON.stringify(f.actual || f.evidence)}`).join("\n") : "- None"}

## Gate

- Next on request: **5.6 WRITE idempotency**
`;

fs.writeFileSync(path.join(outDir, "stage5-5.5-report.md"), report);
fs.writeFileSync(
  path.join(outDir, "stage5-5.5-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage5-5.5-failures.json"),
  JSON.stringify(failures, null, 2)
);
console.log(report);
process.exit(failures.length ? 1 : 0);
