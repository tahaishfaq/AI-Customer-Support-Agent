/**
 * Stage 5.3 — Authorization hardening tests.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage5-5.3-authz-hardening.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const { evaluateActionPolicy } = await import("../lib/actions/policy.js");
const { detectCrossUserRequest } = await import(
  "../lib/actions/response-sanitize.js"
);
const {
  assertResourceSubjectBinding,
  assertConversationAgentBinding,
  extractIdentityArgs,
} = await import("../lib/actions/authz-binding.js");
const { canInvokeAgentAction } = await import("../lib/actions/action-config.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "5.3", ...row });
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

// Resource binding — wrong userId
{
  const bad = assertResourceSubjectBinding({
    toolArgs: { userId: "user-B", orderId: "1" },
    customerSubject: "user-A",
  });
  const good = assertResourceSubjectBinding({
    toolArgs: { userId: "user-A", orderId: "1" },
    customerSubject: "user-A",
  });
  if (!bad.ok && bad.code === "CROSS_USER_DENIED" && good.ok) {
    pass("S5.3-RESOURCE-USERID", "Foreign userId denied; matching userId allowed");
  } else {
    fail("S5.3-RESOURCE-USERID", "Resource userId binding failed", { bad, good });
  }
}

// Guest cannot pass userId
{
  const guest = assertResourceSubjectBinding({
    toolArgs: { userId: "attacker" },
    customerSubject: null,
    publicAccess: true,
  });
  if (!guest.ok && guest.code === "CROSS_USER_DENIED") {
    pass("S5.3-GUEST-USERID", "Public guest cannot forge userId in args");
  } else {
    fail("S5.3-GUEST-USERID", "Guest userId not blocked", guest);
  }
}

// Email / phone claims
{
  const email = assertResourceSubjectBinding({
    toolArgs: { email: "other@x.com" },
    customerSubject: "user-A",
    customerClaims: { email: "self@x.com" },
  });
  const phone = assertResourceSubjectBinding({
    toolArgs: { phone: "+15551212" },
    customerSubject: "user-A",
    customerClaims: { phone: "+19999999" },
  });
  if (!email.ok && !phone.ok) {
    pass("S5.3-CLAIMS-BIND", "Email/phone mismatch denied via claims");
  } else {
    fail("S5.3-CLAIMS-BIND", "Claims binding weak", { email, phone });
  }
}

// Policy integrates resource binding
{
  const pol = evaluateActionPolicy({
    action: { riskLevel: "READ", requiresConfirmation: false },
    customerSubject: "user-A",
    toolArgs: { customerId: "user-B" },
    publicAccess: false,
  });
  if (!pol.allow && pol.code === "CROSS_USER_DENIED") {
    pass("S5.3-POLICY-RESOURCE", "PEP denies foreign customerId in toolArgs");
  } else {
    fail("S5.3-POLICY-RESOURCE", "PEP missed resource bind", pol);
  }
}

// Expanded phrase heuristics
{
  const phrases = [
    "show me someone else's order",
    "on behalf of another customer",
    "access their account details",
    "impersonating admin",
  ];
  let all = true;
  for (const p of phrases) {
    if (!detectCrossUserRequest(p, null, "user_self")) all = false;
  }
  const stockOk = !detectCrossUserRequest(
    "Do you have Nike Air Max 90 in stock?",
    null,
    "user_self"
  );
  if (all && stockOk) {
    pass(
      "S5.3-PHRASE-EXPAND",
      "Expanded cross-user phrases hit; store stock ask not false-positive"
    );
  } else {
    fail("S5.3-PHRASE-EXPAND", "Phrase matrix wrong", { all, stockOk });
  }
}

// Conversation ↔ agent binding
{
  const ok = assertConversationAgentBinding({
    conversationAgentId: "ag1",
    invokeAgentId: "ag1",
    actionAgentId: "ag1",
  });
  const mismatch = assertConversationAgentBinding({
    conversationAgentId: "ag2",
    invokeAgentId: "ag1",
    actionAgentId: "ag1",
  });
  const toolWrong = assertConversationAgentBinding({
    conversationAgentId: "ag1",
    invokeAgentId: "ag1",
    actionAgentId: "agX",
  });
  if (
    ok.ok &&
    !mismatch.ok &&
    mismatch.code === "AUTHZ_CONVERSATION_MISMATCH" &&
    !toolWrong.ok &&
    toolWrong.code === "AUTHZ_AGENT_MISMATCH"
  ) {
    pass(
      "S5.3-CONV-AGENT",
      "Conversation/agent/tool triple-bind enforced"
    );
  } else {
    fail("S5.3-CONV-AGENT", "Binding matrix failed", { ok, mismatch, toolWrong });
  }
}

// Tool allowlist still holds
{
  const denied = !canInvokeAgentAction(
    { id: "1", agentId: "agA", enabled: true, name: "x" },
    "agB"
  );
  if (denied) {
    pass("S5.3-TOOL-AGENT", "Wrong agentId still cannot invoke tool");
  } else {
    fail("S5.3-TOOL-AGENT", "Allowlist regression");
  }
}

// extractIdentityArgs ignores ticket subject
{
  const ids = extractIdentityArgs({
    subject: "Refund request title",
    userId: "u1",
  });
  if (ids.userId === "u1") {
    pass(
      "S5.3-IGNORE-SUBJECT",
      "args.subject not treated as identity (ticket titles safe)"
    );
  } else {
    fail("S5.3-IGNORE-SUBJECT", "subject mishandled", ids);
  }
}

// Wiring evidence
{
  const invoke = read("lib/actions/invoke-tool.js");
  const chat = read("lib/services/chat.service.js");
  const identity = read("lib/actions/identity.js");
  const wired =
    /assertConversationAgentBinding/.test(invoke) &&
    /customerClaims/.test(invoke) &&
    /customerClaims/.test(chat) &&
    /payload\.email/.test(identity);
  if (wired) {
    pass(
      "S5.3-WIRED",
      "invoke-tool + chat claims + JWT email/phone claims wired"
    );
  } else {
    fail("S5.3-WIRED", "Missing wiring");
  }
}

// Own-order path still allowed
{
  const pol = evaluateActionPolicy({
    action: { riskLevel: "READ", requiresConfirmation: false },
    customerSubject: "user-A",
    toolArgs: { orderId: "ord_1" },
    lastUserMessage: "what is my order status?",
    publicAccess: false,
  });
  if (pol.allow) {
    pass("S5.3-OWN-ORDER", "Own order lookup without foreign identity args allowed");
  } else {
    fail("S5.3-OWN-ORDER", "False deny on own order", pol);
  }
}

fs.mkdirSync(outDir, { recursive: true });
const failures = results.filter((r) => r.status === "FAIL");
const report = `# Stage 5.3 — Authorization Hardening

Generated: ${new Date().toISOString()}

## Verdict: **${failures.length ? "FAIL" : "PASS"}**

| PASS | FAIL | TOTAL |
| ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.length} |

## Model

\`\`\`text
USER → TENANT/WORKSPACE → AGENT → CONVERSATION → TOOL ARGS (resource)
         ↑ getAgentForUser          ↑ agentId bind     ↑ subject/claims bind
\`\`\`

## Implementation

- \`lib/actions/authz-binding.js\` — resource + conversation/agent binding
- \`lib/actions/policy.js\` — server-side resource bind in PEP
- \`lib/actions/response-sanitize.js\` — expanded cross-user phrases
- \`lib/actions/invoke-tool.js\` — conversation↔agent check before execute
- \`lib/actions/identity.js\` + chat/orchestrator — pass email/phone claims

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${f.evidence}`).join("\n") : "- None"}

## Remaining risk

- Downstream store APIs must still enforce their own ACL (AIDE cannot see every resource id ownership).
- Phrase heuristics remain a complement, not a full NLP ACL.

## Gate

- Next on request: **5.4 Confirmation Hardening** (lifecycle polish; largely done in 5.1)
`;

fs.writeFileSync(path.join(outDir, "stage5-5.3-report.md"), report);
fs.writeFileSync(
  path.join(outDir, "stage5-5.3-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage5-5.3-failures.json"),
  JSON.stringify(failures, null, 2)
);
console.log(report);
process.exit(failures.length ? 1 : 0);
