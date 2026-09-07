/**
 * Stage 5.6 — WRITE idempotency tests.
 * Run: node --import ./scripts/register-aliases.mjs scripts/stage5-5.6-write-idempotency.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const { hashArgs } = await import("../lib/actions/identity.js");
const { shouldRetryHttpAction } = await import("../lib/actions/tool-errors.js");
const {
  isWriteIdempotencyEligible,
  buildWriteIdempotencyKey,
  beginWriteIdempotency,
  completeWriteIdempotency,
  failWriteIdempotency,
  writeIdempotencyTtlMs,
} = await import("../lib/actions/write-idempotency.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "5.6", ...row });
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

// Eligibility
{
  const writeOk = isWriteIdempotencyEligible({
    riskLevel: "WRITE",
    idempotent: true,
  });
  const destOk = isWriteIdempotencyEligible({
    riskLevel: "DESTRUCTIVE",
    idempotent: true,
  });
  const readNo = isWriteIdempotencyEligible({
    riskLevel: "READ",
    idempotent: true,
  });
  const nonIdem = isWriteIdempotencyEligible({
    riskLevel: "WRITE",
    idempotent: false,
  });
  if (writeOk && destOk && !readNo && !nonIdem) {
    pass(
      "S5.6-ELIGIBLE",
      "WRITE/DESTRUCTIVE+idempotent eligible; READ and non-idempotent WRITE excluded"
    );
  } else {
    fail("S5.6-ELIGIBLE", "Eligibility matrix wrong", {
      writeOk,
      destOk,
      readNo,
      nonIdem,
    });
  }
}

// Stable key
{
  const a = buildWriteIdempotencyKey({
    agentId: "ag1",
    conversationId: "c1",
    actionId: "act1",
    argsHash: hashArgs({ x: 1 }),
  });
  const b = buildWriteIdempotencyKey({
    agentId: "ag1",
    conversationId: "c1",
    actionId: "act1",
    argsHash: hashArgs({ x: 1 }),
  });
  const c = buildWriteIdempotencyKey({
    agentId: "ag1",
    conversationId: "c1",
    actionId: "act1",
    argsHash: hashArgs({ x: 2 }),
  });
  const mcp = buildWriteIdempotencyKey({
    agentId: "ag1",
    conversationId: "c1",
    mcpToolId: "mcp1",
    argsHash: hashArgs({ x: 1 }),
  });
  if (a === b && a !== c && a !== mcp && /^[a-f0-9]{64}$/.test(a)) {
    pass(
      "S5.6-STABLE-KEY",
      "Same args → same key; different args/capability → different key"
    );
  } else {
    fail("S5.6-STABLE-KEY", "Key stability broken", { a, b, c, mcp });
  }
}

// Non-idempotent WRITE not blind-retried (retained from 4.7)
{
  const result = {
    ok: false,
    status: "TIMEOUT",
    errorCode: "TIMEOUT",
    httpStatus: null,
  };
  const noRetry = shouldRetryHttpAction(result, {
    method: "POST",
    riskLevel: "WRITE",
    idempotent: false,
  });
  const yesRetry = shouldRetryHttpAction(result, {
    method: "POST",
    riskLevel: "WRITE",
    idempotent: true,
  });
  if (!noRetry && yesRetry) {
    pass(
      "S5.6-NO-BLIND-RETRY",
      "Non-idempotent WRITE not retried; idempotent WRITE may retry"
    );
  } else {
    fail("S5.6-NO-BLIND-RETRY", "Retry policy wrong", { noRetry, yesRetry });
  }
}

// Wiring
{
  const invoke = read("lib/actions/invoke-tool.js");
  const http = read("lib/actions/http-executor.js");
  const schema = read("prisma/schema.prisma");
  const wired =
    /buildWriteIdempotencyKey/.test(invoke) &&
    /beginWriteIdempotency/.test(invoke) &&
    /completeWriteIdempotency/.test(invoke) &&
    /idempotencyKey: writeKey/.test(invoke) &&
    /Idempotency-Key/.test(http) &&
    /model WriteIdempotencyRecord/.test(schema) &&
    writeIdempotencyTtlMs() >= 60_000;
  if (wired) {
    pass(
      "S5.6-WIRED",
      "invoke-tool + http-executor + WriteIdempotencyRecord schema wired"
    );
  } else {
    fail("S5.6-WIRED", "Missing wiring");
  }
}

// Live DB: acquire → complete → replay (no second side-effect)
if (!process.env.DATABASE_URL) {
  fail("S5.6-DB", "DATABASE_URL missing");
} else {
  try {
    const agentId = `stage56-agent-${Date.now()}`;
    const conversationId = `stage56-conv-${Date.now()}`;
    const actionId = `stage56-act-${Date.now()}`;
    const argsHash = hashArgs({ ticket: "demo", n: Date.now() });
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
    if (first.state !== "acquired") {
      fail("S5.6-LIVE-ACQUIRE", "Expected acquired", first);
    } else {
      pass("S5.6-LIVE-ACQUIRE", "First WRITE acquires IN_FLIGHT lease");
    }

    await completeWriteIdempotency(key, {
      httpStatus: 201,
      bodyText: JSON.stringify({ id: "ticket-1", ok: true }),
      resultForModel: JSON.stringify({ ok: true, body: { id: "ticket-1" } }),
    });

    const second = await beginWriteIdempotency({
      idempotencyKey: key,
      agentId,
      conversationId,
      actionId,
      argsHash,
    });
    if (
      second.state === "replay" &&
      second.replay?.idempotencyReplay === true &&
      second.replay?.httpStatus === 201 &&
      /ticket-1/.test(second.replay.bodyText || "")
    ) {
      pass(
        "S5.6-LIVE-REPLAY",
        "Second invoke with same key returns cached OK (no re-execute)"
      );
    } else {
      fail("S5.6-LIVE-REPLAY", "Replay miss", second);
    }

    // Different args → new lease
    const key2 = buildWriteIdempotencyKey({
      agentId,
      conversationId,
      actionId,
      argsHash: hashArgs({ ticket: "other" }),
    });
    const third = await beginWriteIdempotency({
      idempotencyKey: key2,
      agentId,
      conversationId,
      actionId,
      argsHash: hashArgs({ ticket: "other" }),
    });
    if (third.state === "acquired") {
      pass("S5.6-LIVE-DIFF-ARGS", "Different argsHash gets a fresh lease");
      await failWriteIdempotency(key2, { errorCode: "TEST_CLEANUP" });
    } else {
      fail("S5.6-LIVE-DIFF-ARGS", "Expected acquired for new args", third);
    }

    // ERROR then retry allowed
    const key3 = buildWriteIdempotencyKey({
      agentId,
      conversationId,
      actionId: `${actionId}-err`,
      argsHash: hashArgs({ fail: true }),
    });
    const e1 = await beginWriteIdempotency({
      idempotencyKey: key3,
      agentId,
      conversationId,
      actionId: `${actionId}-err`,
      argsHash: hashArgs({ fail: true }),
    });
    await failWriteIdempotency(key3, { errorCode: "HTTP_500", httpStatus: 500 });
    const e2 = await beginWriteIdempotency({
      idempotencyKey: key3,
      agentId,
      conversationId,
      actionId: `${actionId}-err`,
      argsHash: hashArgs({ fail: true }),
    });
    if (e1.state === "acquired" && e2.state === "acquired") {
      pass("S5.6-LIVE-ERROR-RETRY", "Failed WRITE releases key for retry");
      await failWriteIdempotency(key3, { errorCode: "TEST_CLEANUP" });
    } else {
      fail("S5.6-LIVE-ERROR-RETRY", "Error retry path wrong", { e1, e2 });
    }
  } catch (err) {
    fail("S5.6-DB-ERROR", String(err?.message || err));
  }
}

fs.mkdirSync(outDir, { recursive: true });
const failures = results.filter((r) => r.status === "FAIL");
const report = `# Stage 5.6 — WRITE Idempotency

Generated: ${new Date().toISOString()}

## Verdict: **${failures.length ? "FAIL" : "PASS"}**

| PASS | FAIL | TOTAL |
| ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.length} |

## Design

\`\`\`text
WRITE/DESTRUCTIVE + idempotent=true
  → stable idempotencyKey = sha256(agent|conversation|action|argsHash)
  → begin IN_FLIGHT (unique)
  → execute once (HTTP Idempotency-Key header reused on transport retry)
  → complete OK → later same key replays cached body (no second side-effect)
  → fail ERROR → same key may retry
Non-idempotent WRITE: no key cache; no blind HTTP retry (existing)
\`\`\`

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${JSON.stringify(f.actual || f.evidence)}`).join("\n") : "- None"}

## Gate

- Next on request: **5.7 Knowledge/RAG** (only if bottleneck) or **5.8 Orchestrator**
`;

fs.writeFileSync(path.join(outDir, "stage5-5.6-report.md"), report);
fs.writeFileSync(
  path.join(outDir, "stage5-5.6-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage5-5.6-failures.json"),
  JSON.stringify(failures, null, 2)
);
console.log(report);
process.exit(failures.length ? 1 : 0);
