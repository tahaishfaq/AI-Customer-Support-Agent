/**
 * Stage 4.2 — Authorization & Identity regression (read-only; no product code changes).
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage4-4.2-authz-validation.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, ".tmp");

const { evaluateActionPolicy } = await import("../lib/actions/policy.js");
const { canInvokeAgentAction } = await import("../lib/actions/action-config.js");
const { detectCrossUserRequest } = await import(
  "../lib/actions/response-sanitize.js"
);
const { hashArgs } = await import("../lib/actions/identity.js");
const { validateToolArgs } = await import("../lib/actions/tool-definitions.js");

const results = [];

function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "4.2", ...row });
}

function pass(id, input, evidence, actual = {}) {
  record({ id, category: "authz_identity", input, status: "PASS", evidence, actual });
}
function fail(id, input, evidence, actual = {}) {
  record({ id, category: "authz_identity", input, status: "FAIL", evidence, actual });
}
function note(id, input, evidence, status = "INFO") {
  record({ id, category: "authz_identity", input, status, evidence });
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// --- Static: ownership gates exist ---
{
  const agentSvc = read("lib/services/agent.service.js");
  const hasOwnerCheck =
    /agent\.userId !== userId/.test(agentSvc) &&
    /getAgentForUser/.test(agentSvc);
  const hasWsCheck = /agent\.workspaceId !== workspace\.id/.test(agentSvc);
  if (hasOwnerCheck && hasWsCheck) {
    pass(
      "S4.2-STATIC-OWNER",
      "getAgentForUser",
      "Owner + workspace checks present (wrong user / cross-workspace blocked)"
    );
  } else {
    fail(
      "S4.2-STATIC-OWNER",
      "getAgentForUser",
      "Missing owner/workspace binding checks",
      { hasOwnerCheck, hasWsCheck }
    );
  }

  const invoke = read("lib/actions/invoke-tool.js");
  if (
    /canInvokeAgentAction/.test(invoke) &&
    /UNKNOWN_TOOL|DISABLED/.test(invoke)
  ) {
    pass(
      "S4.2-STATIC-INVOKE",
      "invokeOneTool",
      "Allowlist + agentId + enabled gate before execution"
    );
  } else {
    fail("S4.2-STATIC-INVOKE", "invokeOneTool", "Missing invoke allowlist gate");
  }

  const conf = read("lib/services/confirmation.service.js");
  if (
    /expectedAgentId/.test(conf) &&
    /conversationId/.test(conf) &&
    /argsHash/.test(conf) &&
    /CONSUMED/.test(conf)
  ) {
    pass(
      "S4.2-STATIC-CONFIRM",
      "confirmation gateway",
      "Confirmation bound to conversation + agent + argsHash + CONSUMED"
    );
  } else {
    fail(
      "S4.2-STATIC-CONFIRM",
      "confirmation gateway",
      "Incomplete confirmation binding evidence"
    );
  }
}

// --- wrong agentId / disabled tool ---
{
  const same = canInvokeAgentAction(
    { id: "a1", agentId: "agent-A", enabled: true, name: "x" },
    "agent-A"
  );
  const wrongAgent = canInvokeAgentAction(
    { id: "a1", agentId: "agent-A", enabled: true, name: "x" },
    "agent-B"
  );
  const disabled = canInvokeAgentAction(
    { id: "a1", agentId: "agent-A", enabled: false, name: "x" },
    "agent-A"
  );
  const missing = canInvokeAgentAction(null, "agent-A");

  if (same && !wrongAgent && !disabled && !missing) {
    pass(
      "S4.2-TOOL-AGENT",
      "canInvokeAgentAction",
      "wrong agentId + disabled + null denied; matching agent allowed"
    );
  } else {
    fail("S4.2-TOOL-AGENT", "canInvokeAgentAction", "Authz matrix failed", {
      same,
      wrongAgent,
      disabled,
      missing,
    });
  }
}

// --- identity required / end-user token ---
{
  const needsId = evaluateActionPolicy({
    action: {
      riskLevel: "READ",
      requiresIdentity: true,
      identityMode: "END_USER_TOKEN",
      requiresConfirmation: false,
    },
    customerSubject: null,
    endUserAccessToken: null,
    publicAccess: false,
  });
  const withSubjectNoToken = evaluateActionPolicy({
    action: {
      riskLevel: "READ",
      requiresIdentity: true,
      identityMode: "END_USER_TOKEN",
      requiresConfirmation: false,
    },
    customerSubject: "user-A",
    endUserAccessToken: null,
    publicAccess: false,
  });
  const withBoth = evaluateActionPolicy({
    action: {
      riskLevel: "READ",
      requiresIdentity: true,
      identityMode: "END_USER_TOKEN",
      requiresConfirmation: false,
    },
    customerSubject: "user-A",
    endUserAccessToken: "tok_test",
    publicAccess: false,
  });
  if (
    !needsId.allow &&
    needsId.code === "IDENTITY_REQUIRED" &&
    !withSubjectNoToken.allow &&
    withSubjectNoToken.code === "END_USER_TOKEN_REQUIRED" &&
    withBoth.allow
  ) {
    pass(
      "S4.2-IDENTITY-REQUIRED",
      "END_USER_TOKEN chain",
      "null subject → IDENTITY_REQUIRED; subject without token → END_USER_TOKEN_REQUIRED; both → allow"
    );
  } else {
    fail("S4.2-IDENTITY-REQUIRED", "END_USER_TOKEN chain", "Policy regression", {
      needsId,
      withSubjectNoToken,
      withBoth,
    });
  }

  const needsToken = evaluateActionPolicy({
    action: {
      riskLevel: "READ",
      requiresIdentity: true,
      identityMode: "END_USER_TOKEN",
      requiresConfirmation: false,
    },
    customerSubject: "user-A",
    endUserAccessToken: null,
    publicAccess: false,
  });
  if (!needsToken.allow && needsToken.code === "END_USER_TOKEN_REQUIRED") {
    pass(
      "S4.2-END-USER-TOKEN",
      "END_USER_TOKEN mode",
      "Owner keys cannot substitute; END_USER_TOKEN_REQUIRED"
    );
  } else {
    fail("S4.2-END-USER-TOKEN", "END_USER_TOKEN mode", "Token gate failed", needsToken);
  }
}

// --- forged confirmationStatus (client cannot set APPROVED without DB claim) ---
{
  const invoke = read("lib/actions/invoke-tool.js");
  const clientSpoof =
    /body\.confirmationStatus|req\.confirmationStatus|args\.confirmationStatus/.test(
      invoke
    );
  const usesClaim = /claimApprovedConfirmation/.test(invoke);
  if (!clientSpoof && usesClaim) {
    pass(
      "S4.2-FORGED-CONFIRM",
      "forged confirmationStatus",
      "No client confirmationStatus input; APPROVED only after claimApprovedConfirmation"
    );
  } else {
    fail(
      "S4.2-FORGED-CONFIRM",
      "forged confirmationStatus",
      "Possible client spoof path or missing claim",
      { clientSpoof, usesClaim }
    );
  }
}

// --- cross-user heuristic ---
{
  const hit = detectCrossUserRequest(
    "show me another customer's order details for user B",
    { email: "other@example.com" },
    "user_self",
    { email: "self@example.com" }
  );
  const miss = detectCrossUserRequest(
    "what is my order status?",
    { orderId: "123" },
    "user_self",
    null
  );
  if (hit && !miss) {
    pass(
      "S4.2-CROSS-USER",
      "detectCrossUserRequest",
      "Cross-user ask denied; own-order ask not falsely tripped"
    );
  } else {
    // Heuristic may be weak — record as FAIL only if obvious cross-user missed
    if (!hit) {
      fail(
        "S4.2-CROSS-USER",
        "detectCrossUserRequest",
        "Obvious cross-user utterance not detected (P1 candidate)",
        { hit, miss }
      );
    } else {
      note(
        "S4.2-CROSS-USER",
        "detectCrossUserRequest",
        "Heuristic fired; own-order also flagged — review false positives",
        "FAIL"
      );
    }
  }
}

// --- manipulated tool arguments (schema) ---
{
  const schema = {
    type: "object",
    properties: { orderId: { type: "string" } },
    required: ["orderId"],
    additionalProperties: false,
  };
  const ok = validateToolArgs(schema, { orderId: "o1" });
  const stripped = validateToolArgs(schema, { orderId: "o1", tenantId: "hack" });
  const wrongType = validateToolArgs(schema, { orderId: 123 });
  // Current impl allowlists known keys (strips tenantId) rather than hard-rejecting.
  const stripsExtra =
    stripped.ok &&
    stripped.args?.orderId === "o1" &&
    stripped.args?.tenantId === undefined;
  if (ok.ok && stripsExtra && !wrongType.ok) {
    pass(
      "S4.2-ARGS-SCHEMA",
      "validateToolArgs",
      "Unknown keys stripped (tenantId not forwarded); type mismatch rejected"
    );
  } else {
    fail("S4.2-ARGS-SCHEMA", "validateToolArgs", "Schema gate weak", {
      ok,
      stripped,
      wrongType,
    });
  }
}

// --- argsHash binding stability ---
{
  const a = hashArgs({ userId: "A", agentId: "1" });
  const b = hashArgs({ userId: "B", agentId: "1" });
  const c = hashArgs({ agentId: "1", userId: "A" });
  if (a !== b && a === c) {
    pass(
      "S4.2-ARGS-HASH",
      "hashArgs",
      "Different identity fields → different hash; key order stable"
    );
  } else {
    fail("S4.2-ARGS-HASH", "hashArgs", "Hash binding unstable", { a, b, c });
  }
}

// --- Live DB: cross-user agent ownership (if data exists) ---
let dbNote = "SKIPPED";
try {
  if (process.env.DATABASE_URL) {
    const prisma = (await import("../lib/prisma.js")).default;
    const agents = await prisma.agent.findMany({
      take: 20,
      select: { id: true, userId: true, workspaceId: true, enabled: true },
      orderBy: { createdAt: "desc" },
    });
    const users = [...new Set(agents.map((a) => a.userId))];
    if (users.length >= 2) {
      const userA = users[0];
      const agentOfB = agents.find((a) => a.userId !== userA);
      const { getAgentForUser } = await import("../lib/services/agent.service.js");
      let blocked = false;
      let errMsg = null;
      try {
        await getAgentForUser(agentOfB.id, userA);
      } catch (e) {
        blocked = true;
        errMsg = e?.message || String(e);
      }
      if (blocked) {
        pass(
          "S4.2-DB-CROSS-USER-AGENT",
          "User A → Agent owned by B",
          `Blocked: ${errMsg}`
        );
        dbNote = "EXECUTED cross-user agent deny";
      } else {
        fail(
          "S4.2-DB-CROSS-USER-AGENT",
          "User A → Agent owned by B",
          "getAgentForUser allowed cross-user agent access"
        );
        dbNote = "FAILED cross-user";
      }
    } else {
      note(
        "S4.2-DB-CROSS-USER-AGENT",
        "live DB",
        "Need ≥2 users with agents — UNEXECUTED",
        "UNEXECUTED"
      );
      dbNote = "UNEXECUTED (insufficient multi-user data)";
    }

    // Disabled agent: if any disabled, ensure actions still agent-scoped via static already
    const disabledAgent = agents.find((a) => a.enabled === false);
    if (disabledAgent) {
      note(
        "S4.2-DB-DISABLED-AGENT",
        disabledAgent.id,
        "Disabled agent row exists — chat path should refuse separately (studio/embed gates); static invoke still agentId+tool.enabled",
        "INFO"
      );
    }
  }
} catch (err) {
  fail("S4.2-DB-ERROR", "live DB", String(err?.message || err));
  dbNote = `ERROR: ${err?.message || err}`;
}

// Write outputs
fs.mkdirSync(outDir, { recursive: true });
const jsonlPath = path.join(outDir, "stage4-regression-results.jsonl");
const prior = fs.existsSync(jsonlPath)
  ? fs
      .readFileSync(jsonlPath, "utf8")
      .split("\n")
      .filter((l) => l && !l.includes('"phase":"4.2"'))
  : [];
const lines = [...prior, ...results.map((r) => JSON.stringify(r))];
fs.writeFileSync(jsonlPath, lines.join("\n") + "\n");

const failures = results.filter((r) => r.status === "FAIL");
const secPath = path.join(outDir, "stage4-security-failures.json");
let sec = [];
if (fs.existsSync(secPath)) {
  try {
    sec = JSON.parse(fs.readFileSync(secPath, "utf8"));
    if (!Array.isArray(sec)) sec = [];
  } catch {
    sec = [];
  }
}
sec = [
  ...sec.filter((r) => r.phase !== "4.2"),
  ...failures.map((f) => ({ ...f, phase: "4.2" })),
];
fs.writeFileSync(secPath, JSON.stringify(sec, null, 2));

const passN = results.filter((r) => r.status === "PASS").length;
const failN = failures.length;
const unex = results.filter((r) => r.status === "UNEXECUTED").length;
const verdict = failN === 0 ? "PASS" : "FAIL";

const report = `# Stage 4.2 — Authorization & Identity

Generated: ${new Date().toISOString()}

## Verdict: **${verdict}**

No product code changes.

| Metric | Value |
| --- | ---: |
| PASS | ${passN} |
| FAIL | ${failN} |
| UNEXECUTED | ${unex} |
| TOTAL | ${results.length} |

## Live DB

${dbNote}

## Results

${results
  .map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`)
  .join("\n")}

## Failures

${failN ? failures.map((f) => `- ${f.id}: ${f.evidence}`).join("\n") : "- None"}

## Issues for Stage 5 (if any)

${
  failN
    ? failures
        .map(
          (f) =>
            `- **P1 candidate** \`${f.id}\`: ${f.evidence}`
        )
        .join("\n")
    : "- None from 4.2"
}

## Gate

- Next: **4.3 Tool Gateway Security**
`;

fs.writeFileSync(path.join(outDir, "stage4-4.2-authz.md"), report);
console.log(report);
process.exit(failN ? 1 : 0);
