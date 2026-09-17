import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const { RECOVERY_A8_CASES, validateRecoveryA8Catalog } = await import("../lib/evaluation/recovery-fixtures.js");
const { MAX_TOOL_STEPS, TOOL_LOOP_DEADLINE_MS } = await import("../lib/actions/action-config.js");
const { isWriteIdempotencyEligible, buildWriteIdempotencyKey } = await import("../lib/actions/write-idempotency.js");
const { bindConfirmationActor, normalizeCapabilityRef, statusToLifecyclePhase } = await import("../lib/services/confirmation.service.js");
const { shouldRetryHttpAction } = await import("../lib/actions/tool-errors.js");
const { dedupeToolCalls, findPriorSuccessfulStep, replayStepFromPrior, shouldBreakBatchAfterStep } = await import("../lib/orchestrator/tool-waste.js");
const { stopReasonFromSteps } = await import("../lib/orchestrator/stop-rules.js");

const catalog = validateRecoveryA8Catalog();
const results = [];
let assertions = 0;
const check = (value, message) => { assertions += 1; assert(value, message); };

function runCase(item, offset) {
  if (item.category === "confirmation") {
    check(statusToLifecyclePhase(["PENDING", "APPROVED", "CONSUMED", "DENIED", "EXPIRED"][offset % 5]) !== "UNKNOWN", item.id + " lifecycle mapping");
    check(normalizeCapabilityRef({ actionId: item.actionId }).actionId === item.actionId, item.id + " action binding");
    check(normalizeCapabilityRef({ mcpToolId: "mcp-" + item.agentId }).mcpToolId === "mcp-" + item.agentId, item.id + " MCP binding");
    check(bindConfirmationActor({ conversationSubject: item.customerId, evidenceSubject: item.customerId }) === item.customerId, item.id + " actor bound");
    assert.throws(() => bindConfirmationActor({ conversationSubject: item.customerId, evidenceSubject: item.customerId + "-other" }), /Confirmation actor/);
  } else if (item.category === "idempotency") {
    const first = buildWriteIdempotencyKey({ agentId: item.agentId, conversationId: item.conversationId, actionId: item.actionId, argsHash: "args-" + offset });
    const second = buildWriteIdempotencyKey({ agentId: item.agentId, conversationId: item.conversationId, actionId: item.actionId, argsHash: "args-" + offset });
    const differentArgs = buildWriteIdempotencyKey({ agentId: item.agentId, conversationId: item.conversationId, actionId: item.actionId, argsHash: "other-" + offset });
    check(first === second && first.length === 64, item.id + " stable idempotency key");
    check(first !== differentArgs, item.id + " changed args change key");
    check(isWriteIdempotencyEligible({ riskLevel: "WRITE", idempotent: true }), item.id + " eligible write");
    check(!isWriteIdempotencyEligible({ riskLevel: "WRITE", idempotent: false }), item.id + " non-idempotent write excluded");
    check(!isWriteIdempotencyEligible({ riskLevel: "READ", idempotent: true }), item.id + " read excluded");
  } else if (item.category === "retry") {
    check(shouldRetryHttpAction({ ok: false, errorCode: "TIMEOUT" }, { method: "GET" }), item.id + " GET timeout retries");
    check(shouldRetryHttpAction({ ok: false, httpStatus: 503 }, { method: "GET" }), item.id + " GET 5xx retries");
    check(!shouldRetryHttpAction({ ok: false, httpStatus: 404 }, { method: "GET" }), item.id + " GET 4xx does not retry");
    check(!shouldRetryHttpAction({ ok: false, errorCode: "TIMEOUT" }, { method: "POST", riskLevel: "WRITE", idempotent: false }), item.id + " unsafe write does not retry");
    check(!shouldRetryHttpAction({ ok: false, errorCode: "SSRF_BLOCKED" }, { method: "GET" }), item.id + " SSRF does not retry");
  } else if (item.category === "replay_budget") {
    const calls = [
      { function: { name: "lookup", arguments: JSON.stringify({ id: "same-" + offset }) } },
      { function: { name: "lookup", arguments: JSON.stringify({ id: "same-" + offset }) } },
      { function: { name: "other", arguments: "{}" } },
    ];
    check(dedupeToolCalls(calls).length === 2, item.id + " duplicate calls deduped");
    const prior = findPriorSuccessfulStep([{ name: "lookup", _argsRaw: JSON.stringify({ id: "same-" + offset }), status: "OK", resultForModel: "safe-result" }], "lookup", JSON.stringify({ id: "same-" + offset }));
    check(prior?.idempotentReplay === true, item.id + " successful step replay found");
    check(replayStepFromPrior(prior, "lookup").durationMs === 0, item.id + " replay has no outbound duration");
    check(MAX_TOOL_STEPS === 3 && TOOL_LOOP_DEADLINE_MS === 25_000, item.id + " tool budget frozen");
  } else {
    check(shouldBreakBatchAfterStep({ capabilityResult: { status: "needs_user" } }), item.id + " confirmation stops batch");
    check(shouldBreakBatchAfterStep({ capabilityResult: { status: "escalate" } }), item.id + " handoff stops batch");
    check(!shouldBreakBatchAfterStep({ capabilityResult: { status: "ok" } }), item.id + " successful step continues");
    check(stopReasonFromSteps([{ capabilityResult: { status: "escalate" } }, { capabilityResult: { status: "needs_user" } }]) === "needs_user", item.id + " confirmation wins over handoff");
    check(stopReasonFromSteps([{ capabilityResult: { status: "ok" } }]) === null, item.id + " completed turn has no stop reason");
  }
  return { id: item.id, category: item.category, result: "PASS", evidenceStatus: "VERIFIED" };
}

for (const [offset, item] of RECOVERY_A8_CASES.entries()) {
  try {
    results.push(runCase(item, offset));
  } catch (error) {
    results.push({ id: item.id, category: item.category, result: "FAIL", evidenceStatus: "VERIFIED", error: error.message });
  }
}

const failures = results.filter((item) => item.result !== "PASS");
const report = {
  gate: "A8",
  fixtureCatalog: { ...catalog, sanitized: true, liveProviders: false, staging: false },
  assertions,
  results,
  evidence: "local-contract",
  limitations: ["Does not prove live database replay, crash recovery, reconnect recovery, or provider side-effect behavior."],
};
fs.mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), ".tmp", "aide-recovery-a8-results.json"), JSON.stringify(report, null, 2) + "\n");
if (failures.length) {
  console.error("A8 recovery matrix failed: " + failures.length + "/50");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("A8 recovery matrix passed: " + results.length + "/50 cases, " + assertions + " assertions.");
console.log(JSON.stringify({ ...catalog, reportPath: ".tmp/aide-recovery-a8-results.json", evidence: report.evidence }, null, 2));
