/**
 * Stage 4.7 — Failure / retry / confirmation. Read-only + live confirm if DB.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage4-4.7-failure-validation.mjs
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
const { hashArgs } = await import("../lib/actions/identity.js");
const { validateToolArgs } = await import("../lib/actions/tool-definitions.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "4.7", ...row });
}
function pass(id, input, evidence, actual = {}) {
  record({ id, category: "failure_retry", input, status: "PASS", evidence, actual });
}
function fail(id, input, evidence, actual = {}) {
  record({ id, category: "failure_retry", input, status: "FAIL", evidence, actual });
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// WRITE must not blind-retry
{
  const retryWrite = shouldRetryHttpAction(
    { ok: false, httpStatus: 500, errorCode: "HTTP_ERROR" },
    { method: "POST", riskLevel: "WRITE", idempotent: false }
  );
  const retryGet = shouldRetryHttpAction(
    { ok: false, httpStatus: 500, errorCode: "HTTP_ERROR" },
    { method: "GET", riskLevel: "READ", idempotent: true }
  );
  if (!retryWrite && retryGet) {
    pass(
      "S4.7-NO-WRITE-RETRY",
      "HTTP 500 WRITE",
      "Non-idempotent WRITE not blind-retried; GET may retry"
    );
  } else {
    fail("S4.7-NO-WRITE-RETRY", "HTTP 500 WRITE", "Retry policy unexpected", {
      retryWrite,
      retryGet,
    });
  }
}

// Error messages must not claim success
{
  const msg = safeToolErrorMessage({
    ok: false,
    status: "ERROR",
    errorCode: "HTTP_ERROR",
    httpStatus: 500,
  });
  const formatted = formatToolResultForModel(
    {
      ok: false,
      status: "ERROR",
      errorCode: "HTTP_ERROR",
      bodyText: "upstream failed",
      httpStatus: 500,
    },
    { actionName: "refund_order", guest: false }
  );
  const noSuccess =
    !/successfully completed|success!/i.test(String(msg)) &&
    !/successfully completed/i.test(String(formatted));
  if (noSuccess && /fail|error|unable|try again|problem/i.test(String(msg) + String(formatted))) {
    pass(
      "S4.7-NO-FAKE-SUCCESS",
      "WRITE failed messaging",
      "Error path does not claim Successfully completed"
    );
  } else if (noSuccess) {
    pass(
      "S4.7-NO-FAKE-SUCCESS",
      "WRITE failed messaging",
      "No false success string in error formatting"
    );
  } else {
    fail("S4.7-NO-FAKE-SUCCESS", "WRITE failed messaging", "False success text", {
      msg,
      formatted,
    });
  }
}

// Invalid args
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
    pass("S4.7-INVALID-ARGS", "missing required", "Schema invalid before execute");
  } else {
    fail("S4.7-INVALID-ARGS", "missing required", "Invalid args accepted");
  }
}

// Timeouts configured in HTTP/MCP/web
{
  const http = read("lib/actions/http-executor.js");
  const web = read("lib/services/ai/llm.provider.js");
  const mcp = read("lib/services/mcp.service.js");
  const hasTimeouts =
    /timeout/i.test(http) && /timeout|45_000|45000/.test(web) && /timeout|AbortSignal|signal/i.test(mcp);
  if (hasTimeouts) {
    pass(
      "S4.7-TIMEOUTS",
      "HTTP/MCP/WebSearch",
      "Timeout / abort controls present in executors"
    );
  } else {
    fail("S4.7-TIMEOUTS", "HTTP/MCP/WebSearch", "Missing timeout evidence", {
      http: /timeout/i.test(http),
      web: /timeout/.test(web),
      mcp: /timeout|AbortSignal/i.test(mcp),
    });
  }
}

// Confirmation expired / replay (live if possible)
let dbNote = "SKIPPED";
try {
  if (process.env.DATABASE_URL) {
    const prisma = (await import("../lib/prisma.js")).default;
    const {
      createPendingConfirmation,
      approveConfirmation,
      claimApprovedConfirmation,
      denyConfirmation,
    } = await import("../lib/services/confirmation.service.js");

    const action = await prisma.agentAction.findFirst({
      where: { enabled: true },
      select: { id: true, agentId: true },
    });
    const conv = action
      ? await prisma.conversation.findFirst({
          where: { agentId: action.agentId },
          select: { id: true, agentId: true },
        })
      : null;

    if (action && conv) {
      dbNote = "EXECUTED";
      const args = { stage47: true, t: Date.now() };
      const pending = await createPendingConfirmation(
        conv.id,
        { actionId: action.id },
        args
      );
      await approveConfirmation(pending.id, conv.id, {});
      const hash = hashArgs(args);
      const claim1 = await claimApprovedConfirmation(
        conv.id,
        { actionId: action.id },
        hash,
        { expectedAgentId: conv.agentId }
      );
      const claim2 = await claimApprovedConfirmation(
        conv.id,
        { actionId: action.id },
        hash,
        { expectedAgentId: conv.agentId }
      );
      if (claim1 && !claim2) {
        pass("S4.7-REPLAY", "confirmation replay", "Second claim rejected (CONSUMED)");
      } else {
        fail("S4.7-REPLAY", "confirmation replay", "Replay not blocked", {
          claim1,
          claim2,
        });
      }

      const argsE = { stage47: "exp", t: Date.now() };
      const pendE = await createPendingConfirmation(
        conv.id,
        { actionId: action.id },
        argsE
      );
      await prisma.actionConfirmation.update({
        where: { id: pendE.id },
        data: {
          status: "APPROVED",
          expiresAt: new Date(Date.now() - 5000),
          decidedAt: new Date(),
        },
      });
      const expired = await claimApprovedConfirmation(
        conv.id,
        { actionId: action.id },
        hashArgs(argsE),
        { expectedAgentId: conv.agentId }
      );
      if (!expired) {
        pass("S4.7-EXPIRED", "confirmation expired", "Expired approval not claimable");
      } else {
        fail("S4.7-EXPIRED", "confirmation expired", "Expired still claimed");
      }

      const argsD = { stage47: "deny", t: Date.now() };
      const pendD = await createPendingConfirmation(
        conv.id,
        { actionId: action.id },
        argsD
      );
      await denyConfirmation(pendD.id, conv.id, {});
      const deniedClaim = await claimApprovedConfirmation(
        conv.id,
        { actionId: action.id },
        hashArgs(argsD),
        { expectedAgentId: conv.agentId }
      );
      if (!deniedClaim) {
        pass("S4.7-CANCEL-DENY", "user cancels", "DENIED confirmation not executable");
      } else {
        fail("S4.7-CANCEL-DENY", "user cancels", "Denied confirmation claimable");
      }
    } else {
      record({
        id: "S4.7-DB-SKIP",
        category: "failure_retry",
        status: "UNEXECUTED",
        evidence: "No enabled action + conversation",
      });
      dbNote = "UNEXECUTED";
    }
  }
} catch (err) {
  fail("S4.7-DB-ERROR", "live confirm", String(err?.message || err));
  dbNote = `ERROR: ${err?.message || err}`;
}

fs.mkdirSync(outDir, { recursive: true });
const jsonlPath = path.join(outDir, "stage4-regression-results.jsonl");
const prior = fs.existsSync(jsonlPath)
  ? fs.readFileSync(jsonlPath, "utf8").split("\n").filter((l) => l && !l.includes('"phase":"4.7"'))
  : [];
fs.writeFileSync(jsonlPath, [...prior, ...results.map((r) => JSON.stringify(r))].join("\n") + "\n");
const failures = results.filter((r) => r.status === "FAIL");
const secPath = path.join(outDir, "stage4-security-failures.json");
let sec = [];
try {
  sec = JSON.parse(fs.readFileSync(secPath, "utf8"));
  if (!Array.isArray(sec)) sec = [];
} catch {
  sec = [];
}
sec = [...sec.filter((r) => r.phase !== "4.7"), ...failures.map((f) => ({ ...f, phase: "4.7" }))];
fs.writeFileSync(secPath, JSON.stringify(sec, null, 2));

const verdict = failures.length === 0 ? "PASS" : "FAIL";
const report = `# Stage 4.7 — Failure / Retry / Confirmation

Generated: ${new Date().toISOString()}

## Verdict: **${verdict}**

Live DB: ${dbNote}

| PASS | FAIL | UNEXECUTED | TOTAL |
| ---: | ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.filter((r) => r.status === "UNEXECUTED").length} | ${results.length} |

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${f.evidence}`).join("\n") : "- None"}

## Gate

- Next: **4.8 Performance / Abuse (light)**
`;
fs.writeFileSync(path.join(outDir, "stage4-4.7-failure.md"), report);
console.log(report);
process.exit(failures.length ? 1 : 0);
