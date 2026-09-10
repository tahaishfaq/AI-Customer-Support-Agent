import { createHash } from "node:crypto";

const TRANSITIONS = Object.freeze({
  PREPARED: new Set(["IN_FLIGHT", "FAILED"]),
  IN_FLIGHT: new Set(["SUCCEEDED", "FAILED", "OUTCOME_UNKNOWN"]),
  SUCCEEDED: new Set(),
  FAILED: new Set(),
  OUTCOME_UNKNOWN: new Set(["IN_FLIGHT", "SUCCEEDED", "FAILED"]),
});

function canonical(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonical(value[key])])
  );
}

export function buildWriteRequestFingerprint({
  workspaceId,
  principalScope,
  actionId,
  actionRevisionId,
  method,
  resource,
  resolvedBody = null,
} = {}) {
  const material = canonical({
    workspaceId: String(workspaceId || ""),
    principalScope: String(principalScope || ""),
    actionId: String(actionId || ""),
    actionRevisionId: String(actionRevisionId || ""),
    method: String(method || "").toUpperCase(),
    resource: String(resource || ""),
    resolvedBody,
  });
  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}

export function buildScopedWriteKey({
  workspaceId,
  principalScope,
  logicalOperationId,
  requestFingerprint,
} = {}) {
  return createHash("sha256")
    .update([
      "durable-write-v1",
      String(workspaceId || ""),
      String(principalScope || ""),
      String(logicalOperationId || ""),
      String(requestFingerprint || ""),
    ].join("|"))
    .digest("hex");
}

export function canTransitionWrite(from, to) {
  return Boolean(TRANSITIONS[String(from || "").toUpperCase()]?.has(String(to || "").toUpperCase()));
}

export function assertWriteTransition(from, to) {
  if (!canTransitionWrite(from, to)) {
    throw new Error(`Invalid durable write transition: ${from} -> ${to}`);
  }
  return true;
}

export function classifyDispatchFailure({ responseReceived, transportError } = {}) {
  if (responseReceived) return "RESPONSE_RECEIVED";
  if (transportError) return "OUTCOME_UNKNOWN";
  return "FAILED";
}

export function canReconcile(status) {
  return String(status || "").toUpperCase() === "OUTCOME_UNKNOWN";
}

export function shouldDispatch({ status, leaseUntil, now = new Date() } = {}) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PREPARED") return true;
  if (normalized !== "IN_FLIGHT") return false;
  return !leaseUntil || new Date(leaseUntil) <= new Date(now);
}

