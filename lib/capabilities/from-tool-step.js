/**
 * O01-O1 — Adapt legacy tool-loop step → CapabilityResult (behavior-preserving).
 * Existing `resultForModel` / pendingConfirmation stay; envelope is additive.
 */
import {
  ok,
  denied,
  needsUser,
  errorResult,
  escalate,
} from "./result.js";
import { mapPolicyCodeToCapability } from "../orchestrator/map-policy.js";
import { TOOL_RUN_STATUS } from "../actions/action-config.js";

/**
 * @param {{
 *   name?: string,
 *   status?: string,
 *   errorCode?: string|null,
 *   httpStatus?: number|null,
 *   durationMs?: number,
 *   resultForModel?: string,
 *   pendingConfirmation?: object|null,
 * }} step
 */
export function capabilityResultFromToolStep(step) {
  const capabilityId = String(step?.name || "");
  const latencyMs = Number(step?.durationMs) || 0;
  const forModel = String(step?.resultForModel ?? "");
  const codeRaw = step?.errorCode || step?.status || "UNKNOWN";
  const code = String(codeRaw).toUpperCase();

  const isOk =
    (step?.status === TOOL_RUN_STATUS.OK ||
      code === "OK" ||
      code === "CACHE_HIT") &&
    code !== "HANDOFF" &&
    code !== "ESCALATE";

  const mapped =
    code === "HANDOFF" || code === "ESCALATE"
      ? mapPolicyCodeToCapability(code)
      : isOk
        ? mapPolicyCodeToCapability(null, { httpOk: true })
        : mapPolicyCodeToCapability(code);

  /** @type {{ type: string, payload?: object }} */
  let forClient = { type: mapped.clientType };
  if (mapped.clientType === "confirm" && step?.pendingConfirmation) {
    forClient = {
      type: "confirm",
      payload: step.pendingConfirmation,
    };
  } else if (mapped.status === "ok" && step?.httpStatus) {
    forClient = { type: "data" };
  }

  const meta = {
    capabilityId,
    latencyMs,
    ...(step?.httpStatus != null ? { httpStatus: Number(step.httpStatus) } : {}),
  };

  if (mapped.status === "ok") {
    return ok({ code: isOk ? (code === "CACHE_HIT" ? "CACHE_HIT" : "OK") : "OK", forModel, forClient, meta });
  }
  if (mapped.status === "denied") {
    return denied({ code, forModel, forClient, meta });
  }
  if (mapped.status === "needs_user") {
    return needsUser({ code, forModel, forClient, meta });
  }
  if (mapped.status === "escalate") {
    return escalate({ code, forModel, forClient, meta });
  }
  return errorResult({ code, forModel, forClient, meta });
}

/**
 * Attach `capabilityResult` without changing legacy fields.
 * @template {Record<string, unknown>} T
 * @param {T} step
 * @returns {T & { capabilityResult: object }}
 */
export function withCapabilityResult(step) {
  const capabilityResult = capabilityResultFromToolStep(step);
  return { ...step, capabilityResult };
}
