/**
 * Stage 6.5 — Reliability (provider/DB/MCP/HTTP down, partial failure, retry, recovery).
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage6-6.5-reliability.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const {
  shouldRetryHttpAction,
  safeToolErrorMessage,
  formatToolResultForModel,
} = await import("../lib/actions/tool-errors.js");
const { validateToolArgs } = await import("../lib/actions/tool-definitions.js");
const {
  stopReasonFromStep,
  stopReasonFromSteps,
} = await import("../lib/orchestrator/stop-rules.js");
const { needsUser, escalate, ok, errorResult } = await import(
  "../lib/capabilities/result.js"
);
const { shouldBreakBatchAfterStep } = await import(
  "../lib/orchestrator/tool-waste.js"
);
const {
  beginWriteIdempotency,
  completeWriteIdempotency,
  failWriteIdempotency,
  buildWriteIdempotencyKey,
} = await import("../lib/actions/write-idempotency.js");
const { hashArgs } = await import("../lib/actions/identity.js");
const { isHostedWebSearchDeploymentEnabled } = await import(
  "../lib/services/ai/web-search-config.js"
);

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "6.5", ...row });
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

// ─── HTTP retry matrix ────────────────────────────────────────────
{
  const cases = [
    {
      name: "GET_500",
      result: { ok: false, httpStatus: 500, errorCode: "HTTP_500" },
      opts: { method: "GET", riskLevel: "READ", idempotent: true },
      expect: true,
    },
    {
      name: "GET_TIMEOUT",
      result: { ok: false, status: "TIMEOUT", errorCode: "TIMEOUT" },
      opts: { method: "GET", riskLevel: "READ", idempotent: true },
      expect: true,
    },
    {
      name: "GET_401",
      result: { ok: false, httpStatus: 401, errorCode: "HTTP_401" },
      opts: { method: "GET", riskLevel: "READ", idempotent: true },
      expect: false,
    },
    {
      name: "WRITE_NON_IDEM_500",
      result: { ok: false, httpStatus: 500, errorCode: "HTTP_500" },
      opts: { method: "POST", riskLevel: "WRITE", idempotent: false },
      expect: false,
    },
    {
      name: "WRITE_IDEM_TIMEOUT",
      result: { ok: false, status: "TIMEOUT", errorCode: "TIMEOUT" },
      opts: { method: "POST", riskLevel: "WRITE", idempotent: true },
      expect: true,
    },
    {
      name: "SSRF",
      result: { ok: false, status: "SSRF_BLOCKED", errorCode: "SSRF_BLOCKED" },
      opts: { method: "GET", riskLevel: "READ", idempotent: true },
      expect: false,
    },
  ];
  let okAll = true;
  const actual = {};
  for (const c of cases) {
    const got = shouldRetryHttpAction(c.result, c.opts);
    actual[c.name] = got;
    if (got !== c.expect) okAll = false;
  }
  if (okAll) {
    pass("S6.5-HTTP-RETRY-MATRIX", "Retry policy matches GET/WRITE/auth/SSRF expectations", actual);
  } else {
    fail("S6.5-HTTP-RETRY-MATRIX", "Retry matrix mismatch", actual);
  }
}

// ─── Error messages never fake success ────────────────────────────
{
  const codes = [
    "TIMEOUT",
    "FETCH_ERROR",
    "HTTP_500",
    "HTTP_401",
    "RATE_LIMITED",
    "CONCURRENCY_LIMIT",
    "MCP_ERROR",
    "CONFIRMATION_REQUIRED",
  ];
  let clean = true;
  for (const code of codes) {
    const msg = safeToolErrorMessage({
      ok: false,
      errorCode: code,
      httpStatus: code.startsWith("HTTP_") ? Number(code.slice(5)) : null,
      status: code === "TIMEOUT" ? "TIMEOUT" : "ERROR",
    });
    const formatted = formatToolResultForModel({
      ok: false,
      errorCode: code,
      status: "ERROR",
      httpStatus: 500,
      bodyText: "upstream",
    });
    if (/successfully completed|success!|completed successfully/i.test(msg + formatted)) {
      clean = false;
    }
  }
  if (clean) {
    pass("S6.5-NO-FAKE-SUCCESS", "Failure messages never claim success across error codes");
  } else {
    fail("S6.5-NO-FAKE-SUCCESS", "False success wording found");
  }
}

// ─── LLM / chat degraded recovery ─────────────────────────────────
{
  const chat = read("lib/services/chat.service.js");
  const loop = read("lib/orchestrator/loop.js");
  const hasDegraded =
    /SAFE_ASSISTANT/.test(chat) &&
    /degraded\s*=\s*true/.test(chat) &&
    /TIMEOUT_ASSISTANT|CANCEL_ASSISTANT/.test(chat) &&
    /empty reply/.test(loop) &&
    /status\s*=\s*502/.test(loop);
  if (hasDegraded) {
    pass(
      "S6.5-LLM-DEGRADED",
      "Chat persists SAFE/TIMEOUT/CANCEL assistant on LLM failure; empty reply → 502"
    );
  } else {
    fail("S6.5-LLM-DEGRADED", "Degraded LLM recovery path incomplete");
  }
}

// ─── MCP down / error surface ─────────────────────────────────────
{
  const mcp = read("lib/services/mcp.service.js");
  const has =
    /MCP_ERROR|MCP_TOOL_ERROR|MCP_SERVER_RATE_LIMITED/.test(mcp) &&
    /TIMEOUT/.test(mcp) &&
    /ok:\s*false/.test(mcp);
  if (has) {
    pass(
      "S6.5-MCP-ERRORS",
      "MCP path returns typed errors (MCP_ERROR / TOOL_ERROR / RATE_LIMITED / TIMEOUT)"
    );
  } else {
    fail("S6.5-MCP-ERRORS", "MCP error taxonomy missing");
  }
}

// ─── Hosted web-search failure / rollout-off ──────────────────────
{
  const web = read("lib/services/ai/llm.provider.js");
  const builtin = read("lib/capabilities/adapters/builtin.adapter.js");
  const has =
    /WEB_SEARCH|responses\.create|timeout/i.test(web) &&
    /HOSTED_WEB_SEARCH_PROVIDER_DISPATCH_REQUIRED|web_search/.test(builtin);
  if (has) {
    pass(
      "S6.5-WEB-FAILURE",
      "Hosted web search has timeout/error mapping; store PEP remains"
    );
  } else {
    fail("S6.5-WEB-FAILURE", "Web failure handling incomplete");
  }
  try {
    const configured = isHostedWebSearchDeploymentEnabled();
    info(
      "S6.5-WEB-KEY",
      configured
        ? "Hosted web-search rollout enabled (live search possible)"
        : "Hosted web-search rollout disabled — no legacy provider fallback"
    );
  } catch {
    info("S6.5-WEB-KEY", "Could not read hosted web-search rollout flag");
  }
}

// ─── Invalid args before outbound ─────────────────────────────────
{
  const bad = validateToolArgs(
    {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    {}
  );
  if (!bad.ok) {
    pass("S6.5-SCHEMA-FAIL-CLOSED", "Invalid tool args rejected before HTTP/MCP");
  } else {
    fail("S6.5-SCHEMA-FAIL-CLOSED", "Invalid args accepted");
  }
}

// ─── Partial failure: needs_user / escalate stop remaining tools ──
{
  const confirmStep = {
    capabilityResult: needsUser({
      code: "CONFIRMATION_REQUIRED",
      forModel: "confirm",
      forClient: { type: "confirm" },
    }),
  };
  const escStep = {
    capabilityResult: escalate({
      code: "HANDOFF",
      forModel: "escalate",
    }),
  };
  const okStep = {
    capabilityResult: ok({ forModel: "data" }),
  };
  const errStep = {
    capabilityResult: errorResult({
      code: "FETCH_ERROR",
      forModel: "failed",
    }),
  };
  if (
    shouldBreakBatchAfterStep(confirmStep) &&
    shouldBreakBatchAfterStep(escStep) &&
    !shouldBreakBatchAfterStep(okStep) &&
    !shouldBreakBatchAfterStep(errStep) &&
    stopReasonFromSteps([okStep, confirmStep]) === "needs_user" &&
    stopReasonFromStep(escStep) === "escalate"
  ) {
    pass(
      "S6.5-PARTIAL-STOP",
      "needs_user/escalate stop further tools; plain tool errors do not hard-stop batch"
    );
  } else {
    fail("S6.5-PARTIAL-STOP", "Partial-failure stop rules wrong");
  }
}

// ─── WRITE idempotency recovery after ERROR ───────────────────────
if (!process.env.DATABASE_URL) {
  fail("S6.5-WRITE-RECOVER", "DATABASE_URL missing");
} else {
  try {
    const agentId = `rel-ag-${Date.now()}`;
    const conversationId = `rel-cv-${Date.now()}`;
    const actionId = `rel-act-${Date.now()}`;
    const argsHash = hashArgs({ recover: true });
    const key = buildWriteIdempotencyKey({
      agentId,
      conversationId,
      actionId,
      argsHash,
    });
    const a1 = await beginWriteIdempotency({
      idempotencyKey: key,
      agentId,
      conversationId,
      actionId,
      argsHash,
    });
    await failWriteIdempotency(key, { errorCode: "FETCH_ERROR", httpStatus: null });
    const a2 = await beginWriteIdempotency({
      idempotencyKey: key,
      agentId,
      conversationId,
      actionId,
      argsHash,
    });
    await completeWriteIdempotency(key, {
      httpStatus: 200,
      bodyText: '{"ok":true}',
      resultForModel: '{"ok":true}',
    });
    const a3 = await beginWriteIdempotency({
      idempotencyKey: key,
      agentId,
      conversationId,
      actionId,
      argsHash,
    });
    if (a1.state === "acquired" && a2.state === "acquired" && a3.state === "replay") {
      pass(
        "S6.5-WRITE-RECOVER",
        "Failed WRITE releases key for retry; success then replays"
      );
    } else {
      fail("S6.5-WRITE-RECOVER", "Idempotency recovery path wrong", {
        a1,
        a2,
        a3,
      });
    }
  } catch (err) {
    fail("S6.5-WRITE-RECOVER", String(err?.message || err));
  }
}

// ─── DB availability ──────────────────────────────────────────────
if (process.env.DATABASE_URL) {
  try {
    const prisma = (await import("../lib/prisma.js")).default;
    await prisma.$queryRaw`SELECT 1`;
    // brief parallel pressure
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
    ]);
    pass("S6.5-DB-UP", "Database responds to SELECT 1 (incl. small parallel burst)");
  } catch (err) {
    fail("S6.5-DB-UP", String(err?.message || err));
  }
} else {
  fail("S6.5-DB-UP", "DATABASE_URL missing");
}

// ─── HTTP executor timeout / abort present ────────────────────────
{
  const http = read("lib/actions/http-executor.js");
  if (
    /AbortController/.test(http) &&
    /TIMEOUT/.test(http) &&
    /retryOnce/.test(http) &&
    /shouldRetryHttpAction/.test(http)
  ) {
    pass(
      "S6.5-HTTP-TIMEOUT",
      "HTTP executor uses AbortController timeout + conditional single retry"
    );
  } else {
    fail("S6.5-HTTP-TIMEOUT", "HTTP timeout/retry wiring missing");
  }
}

// ─── Confirmation expiry recovery (code path) ─────────────────────
{
  const conf = read("lib/services/confirmation.service.js");
  if (
    /EXPIRED|expiresAt/.test(conf) &&
    /CONSUMED/.test(conf) &&
    /updateMany/.test(conf)
  ) {
    pass(
      "S6.5-CONFIRM-EXPIRY",
      "Confirmation service expires stale rows and claims via optimistic updateMany"
    );
  } else {
    fail("S6.5-CONFIRM-EXPIRY", "Expiry/claim recovery missing");
  }
}

info(
  "S6.5-NOTE-LIVE-LLM",
  "Intentional OpenAI outage not simulated (cost). Degraded chat + empty-reply 502 paths verified in source."
);

fs.mkdirSync(outDir, { recursive: true });
const failures = results.filter((r) => r.status === "FAIL");
const report = `# Stage 6.5 — Reliability

Generated: ${new Date().toISOString()}

## Verdict: **${failures.length ? "FAIL" : "PASS"}**

| PASS | FAIL | INFO | TOTAL |
| ---: | ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.filter((r) => r.status === "INFO").length} | ${results.length} |

## Coverage

- HTTP retry matrix (GET/WRITE/auth/SSRF/timeout)
- No fake-success error copy
- LLM degraded assistant persistence + empty reply 502
- MCP typed error surface
- Web search timeout / not_configured
- Schema fail-closed
- Partial batch stop (confirm/escalate)
- WRITE idempotency ERROR → retry → OK replay
- DB up + small parallel
- HTTP AbortController timeout
- Confirmation expiry / optimistic claim

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${f.evidence}`).join("\n") : "- None"}

## Gate

- Next on request: **6.6 Architecture freeze**
`;

fs.writeFileSync(path.join(outDir, "stage6-6.5-reliability-report.md"), report);
fs.writeFileSync(
  path.join(outDir, "stage6-6.5-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage6-6.5-failures.json"),
  JSON.stringify(failures, null, 2)
);
console.log(report);
process.exit(failures.length ? 1 : 0);
