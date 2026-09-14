/**
 * Stage 6.4 — Abuse (spam, expensive search, oversized I/O, repeated writes).
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage6-6.4-abuse.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const { rateLimit } = await import("../lib/rate-limit.js");
const {
  pubChatLimitOpts,
  studioChatLimitOpts,
  actionOutboundLimitOpts,
} = await import("../lib/rate-limit-config.js");
const {
  MAX_TOOL_STEPS,
  TOOL_LOOP_DEADLINE_MS,
} = await import("../lib/actions/action-config.js");
const { MAX_RESPONSE_CHARS, MAX_GUEST_RESPONSE_CHARS } = await import(
  "../lib/actions/http-executor.js"
);
const { MAX_KNOWLEDGE_CHARS } = await import(
  "../lib/services/ai/knowledge-retrieve.js"
);
const {
  routeSource,
  mayInvokeWebSearch,
  filterCapabilitiesForSourceRoute,
} = await import("../lib/services/ai/source-policy.js");
const { fenceUntrustedText } = await import(
  "../lib/actions/untrusted-result.js"
);
const { shouldRetryHttpAction } = await import("../lib/actions/tool-errors.js");
const { dedupeToolCalls } = await import("../lib/orchestrator/tool-waste.js");
const { hashArgs } = await import("../lib/actions/identity.js");
const {
  buildWriteIdempotencyKey,
  beginWriteIdempotency,
  completeWriteIdempotency,
} = await import("../lib/actions/write-idempotency.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "6.4", ...row });
}
function pass(id, evidence, actual = {}) {
  record({ id, status: "PASS", evidence, actual });
}
function fail(id, evidence, actual = {}) {
  record({ id, status: "FAIL", evidence, actual });
}
function info(id, evidence, actual = {}) {
  record({ id, status: "INFO", evidence, actual });
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function burst(key, limit, windowMs, n) {
  let allowed = 0;
  let denied = 0;
  for (let i = 0; i < n; i++) {
    const r = rateLimit(key, { limit, windowMs });
    if (r.ok) allowed += 1;
    else denied += 1;
  }
  return { allowed, denied };
}

// ─── Chat spam ────────────────────────────────────────────────────
{
  const pub = pubChatLimitOpts();
  const studio = studioChatLimitOpts();
  const pubBurst = burst(
    `abuse-pub-${Date.now()}`,
    pub.limit,
    pub.windowMs,
    pub.limit + 15
  );
  const studioBurst = burst(
    `abuse-studio-${Date.now()}`,
    studio.limit,
    studio.windowMs,
    studio.limit + 20
  );
  if (
    pubBurst.allowed === pub.limit &&
    pubBurst.denied === 15 &&
    studioBurst.allowed === studio.limit &&
    studioBurst.denied === 20
  ) {
    pass(
      "S6.4-CHAT-SPAM",
      `Pub chat ${pub.limit}/min + studio ${studio.limit}/min enforce after burst`,
      { pub, studio, pubBurst, studioBurst }
    );
  } else {
    fail("S6.4-CHAT-SPAM", "Chat rate limits not enforcing", {
      pubBurst,
      studioBurst,
      pub,
      studio,
    });
  }
}

// ─── Outbound tool spam ───────────────────────────────────────────
{
  const outbound = actionOutboundLimitOpts();
  const b = burst(
    `abuse-outbound-${Date.now()}`,
    outbound.limit,
    outbound.windowMs,
    outbound.limit + 10
  );
  if (b.allowed === outbound.limit && b.denied === 10) {
    pass(
      "S6.4-OUTBOUND-SPAM",
      `Outbound actions capped at ${outbound.limit}/${outbound.windowMs}ms`,
      b
    );
  } else {
    fail("S6.4-OUTBOUND-SPAM", "Outbound spam not capped", { outbound, b });
  }
}

// ─── Expensive web search abuse ───────────────────────────────────
{
  const store = "What is the price of Nike Air Max in my store?";
  const web = "Search the internet for today's news headlines";
  const caps = [
    { name: "web_search", riskLevel: "READ" },
    { name: "get_stock", riskLevel: "READ" },
  ];
  const storeFiltered = filterCapabilitiesForSourceRoute(
    caps,
    routeSource(store)
  );
  const webFiltered = filterCapabilitiesForSourceRoute(
    caps,
    routeSource(web, { webSearchEnabled: true })
  );
  // Spamming store asks must never unlock web
  let storeSpamOk = true;
  for (let i = 0; i < 50; i++) {
    if (mayInvokeWebSearch(store)) storeSpamOk = false;
  }
  if (
    storeSpamOk &&
    !storeFiltered.some((c) => c.name === "web_search") &&
    webFiltered.some((c) => c.name === "web_search") &&
    MAX_TOOL_STEPS === 3
  ) {
    pass(
      "S6.4-WEB-ABUSE",
      "Store spam cannot unlock web_search; explicit web allowed but ≤3 tool steps/turn"
    );
  } else {
    fail("S6.4-WEB-ABUSE", "Web abuse controls weak", {
      storeSpamOk,
      storeFiltered,
      webFiltered,
    });
  }
}

// ─── Large prompts / outputs ──────────────────────────────────────
{
  const huge = "A".repeat(100_000);
  const fenced = fenceUntrustedText(huge, {
    source: "tool",
    maxChars: 4800,
    neutralize: true,
  });
  const loop = read("lib/orchestrator/loop.js");
  const trunc = /MAX_TOOL_RESULT_CHARS\s*=\s*(\d+)/.exec(loop);
  const maxResult = trunc ? Number(trunc[1]) : 0;
  if (
    fenced.length < 20_000 &&
    /UNTRUSTED EXTERNAL DATA/i.test(fenced) &&
    maxResult === 4000 &&
    MAX_RESPONSE_CHARS <= 8000 &&
    MAX_GUEST_RESPONSE_CHARS <= 1200 &&
    MAX_KNOWLEDGE_CHARS === 12_000
  ) {
    pass(
      "S6.4-LARGE-IO",
      `Huge tool body fenced/truncated (out=${fenced.length}); HTTP max=${MAX_RESPONSE_CHARS}, guest=${MAX_GUEST_RESPONSE_CHARS}, knowledge=${MAX_KNOWLEDGE_CHARS}, loop trunc=${maxResult}`
    );
  } else {
    fail("S6.4-LARGE-IO", "Oversized I/O not bounded", {
      outLen: fenced.length,
      maxResult,
      MAX_RESPONSE_CHARS,
      MAX_GUEST_RESPONSE_CHARS,
      MAX_KNOWLEDGE_CHARS,
    });
  }
}

{
  const chat = read("lib/services/chat.service.js");
  if (/MAX_HISTORY_MESSAGES\s*=\s*20/.test(chat)) {
    pass("S6.4-HISTORY-CAP", "Chat history capped at 20 messages");
  } else {
    fail("S6.4-HISTORY-CAP", "History cap missing/changed");
  }
}

// ─── Duplicate tool_call spam in one batch ────────────────────────
{
  const spam = Array.from({ length: 30 }, (_, i) => ({
    id: `c${i}`,
    function: { name: "get_order", arguments: '{"id":"1"}' },
  }));
  const out = dedupeToolCalls(spam);
  if (out.length === 1) {
    pass(
      "S6.4-TOOL-DEDUPE-SPAM",
      "30 identical tool_calls collapsed to 1 before invoke"
    );
  } else {
    fail("S6.4-TOOL-DEDUPE-SPAM", "Dedupe failed under spam", {
      len: out.length,
    });
  }
}

// ─── Repeated WRITE → idempotency replay ──────────────────────────
if (!process.env.DATABASE_URL) {
  fail("S6.4-WRITE-REPEAT", "DATABASE_URL missing");
} else {
  try {
    const agentId = `abuse-ag-${Date.now()}`;
    const conversationId = `abuse-cv-${Date.now()}`;
    const actionId = `abuse-act-${Date.now()}`;
    const argsHash = hashArgs({ ticket: "same", n: 1 });
    const key = buildWriteIdempotencyKey({
      agentId,
      conversationId,
      actionId,
      argsHash,
    });
    const first = await beginWriteIdempotency({
      idempotencyKey: key,
      agentId,
      conversationId,
      actionId,
      argsHash,
    });
    await completeWriteIdempotency(key, {
      httpStatus: 201,
      bodyText: JSON.stringify({ id: "t1" }),
      resultForModel: JSON.stringify({ ok: true }),
    });
    let replays = 0;
    for (let i = 0; i < 5; i++) {
      const r = await beginWriteIdempotency({
        idempotencyKey: key,
        agentId,
        conversationId,
        actionId,
        argsHash,
      });
      if (r.state === "replay") replays += 1;
    }
    if (first.state === "acquired" && replays === 5) {
      pass(
        "S6.4-WRITE-REPEAT",
        "5 identical WRITE keys replay cached OK (no re-execute)"
      );
    } else {
      fail("S6.4-WRITE-REPEAT", "Idempotency replay under repeat failed", {
        first,
        replays,
      });
    }
  } catch (err) {
    fail("S6.4-WRITE-REPEAT", String(err?.message || err));
  }
}

// Non-idempotent WRITE still no blind retry even if spammed
{
  const result = {
    ok: false,
    status: "TIMEOUT",
    errorCode: "TIMEOUT",
    httpStatus: null,
  };
  const retry = shouldRetryHttpAction(result, {
    method: "POST",
    riskLevel: "WRITE",
    idempotent: false,
  });
  if (!retry) {
    pass(
      "S6.4-WRITE-NO-BLIND-RETRY",
      "Non-idempotent WRITE timeout is not auto-retried under abuse"
    );
  } else {
    fail("S6.4-WRITE-NO-BLIND-RETRY", "Blind retry still possible");
  }
}

// Deadline bounds expensive loops
{
  if (TOOL_LOOP_DEADLINE_MS === 25_000 && MAX_TOOL_STEPS === 3) {
    pass(
      "S6.4-LOOP-BOUND",
      "Expensive multi-tool abuse hard-capped at 3 steps / 25s"
    );
  } else {
    fail("S6.4-LOOP-BOUND", "Loop bounds drifted");
  }
}

info(
  "S6.4-NOTE-LIVE-CHAT",
  "Full HTTP chat flood against running Next server not executed here — pub/studio rateLimit helpers are the same gates used by API routes."
);

fs.mkdirSync(outDir, { recursive: true });
const failures = results.filter((r) => r.status === "FAIL");
const report = `# Stage 6.4 — Abuse

Generated: ${new Date().toISOString()}

## Verdict: **${failures.length ? "FAIL" : "PASS"}**

| PASS | FAIL | INFO | TOTAL |
| ---: | ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.filter((r) => r.status === "INFO").length} | ${results.length} |

## Coverage

- Chat spam (pub + studio rate limits)
- Outbound tool spam
- Web search cannot be unlocked via store spam; step cap
- Oversized tool/knowledge/history I/O bounds + fence
- Duplicate tool_call collapse
- Repeated identical WRITE → durable idempotency replay
- Non-idempotent WRITE no blind retry
- Loop deadline / max steps

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${f.evidence}`).join("\n") : "- None"}

## Gate

- Next on request: **6.5 Reliability**
`;

fs.writeFileSync(path.join(outDir, "stage6-6.4-abuse-report.md"), report);
fs.writeFileSync(
  path.join(outDir, "stage6-6.4-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage6-6.4-failures.json"),
  JSON.stringify(failures, null, 2)
);
console.log(report);
process.exit(failures.length ? 1 : 0);
