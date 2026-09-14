/**
 * Stage 5.8 — Orchestrator waste helpers (dedupe, in-turn replay, early batch stop).
 */
import { createHash } from "node:crypto";
import { stopReasonFromStep } from "@/lib/orchestrator/stop-rules";

/**
 * Stable fingerprint for a tool call (name + normalized args JSON).
 * @param {string} name
 * @param {string} argsRaw
 */
export function toolCallFingerprint(name, argsRaw) {
  let normalized = "{}";
  try {
    const parsed = JSON.parse(String(argsRaw || "{}"));
    normalized = JSON.stringify(sortKeys(parsed));
  } catch {
    normalized = String(argsRaw || "");
  }
  return createHash("sha256")
    .update(`${String(name || "")}|${normalized}`)
    .digest("hex")
    .slice(0, 32);
}

function sortKeys(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const out = {};
  for (const k of Object.keys(value).sort()) {
    out[k] = sortKeys(value[k]);
  }
  return out;
}

/**
 * Drop duplicate tool_calls in one LLM batch (keep first).
 * @param {Array<{ id?: string, function?: { name?: string, arguments?: string } }>} toolCalls
 */
export function dedupeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length < 2) {
    return toolCalls || [];
  }
  const seen = new Set();
  const out = [];
  for (const call of toolCalls) {
    const name = call?.function?.name || "";
    const argsRaw = call?.function?.arguments || "{}";
    const fp = toolCallFingerprint(name, argsRaw);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(call);
  }
  return out;
}

/**
 * Reuse a prior successful step in this turn with the same name+args.
 * @param {Array<{ name?: string, status?: string, resultForModel?: string, _fingerprint?: string }>} toolSteps
 * @param {string} name
 * @param {string} argsRaw
 */
export function findPriorSuccessfulStep(toolSteps, name, argsRaw) {
  const fp = toolCallFingerprint(name, argsRaw);
  const list = Array.isArray(toolSteps) ? toolSteps : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const step = list[i];
    if (!step) continue;
    if (String(step.name || "") !== String(name || "")) continue;
    const stepFp =
      step._fingerprint ||
      toolCallFingerprint(step.name, step._argsRaw || "{}");
    if (stepFp !== fp) continue;
    const ok =
      step.status === "OK" || step.capabilityResult?.status === "ok";
    if (ok && step.resultForModel) {
      return { ...step, _fingerprint: fp, idempotentReplay: true };
    }
  }
  return null;
}

/**
 * After needs_user / escalate, do not invoke remaining tools in the same batch.
 * @param {object} step
 */
export function shouldBreakBatchAfterStep(step) {
  return Boolean(stopReasonFromStep(step));
}

/**
 * Synthetic step when skipping a duplicate invoke.
 */
export function replayStepFromPrior(prior, name) {
  return {
    ...prior,
    name: name || prior.name,
    durationMs: 0,
    idempotentReplay: true,
    capabilityResult: prior.capabilityResult
      ? { ...prior.capabilityResult, latencyMs: 0 }
      : prior.capabilityResult,
  };
}
