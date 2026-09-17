import { TENANT_FIXTURES } from "./tenant-fixtures.js";

export const PROVIDER_A12_FIXTURE_VERSION = "provider-gate-a12-2026-09-16-v1";

const groups = [
  "retry_policy",
  "error_surface",
  "durable_write",
  "worker_lease",
  "upload_limits",
  "webhook_identity",
  "realtime_scale",
  "tenant_fairness",
];

const scenarios = [
  ["retry_policy", "GET 500 is eligible for one retry", "RETRY"],
  ["retry_policy", "GET timeout is eligible for one retry", "RETRY"],
  ["retry_policy", "GET 429 is not retried by action executor", "NO_RETRY"],
  ["retry_policy", "non-idempotent POST is never retried", "NO_RETRY"],
  ["retry_policy", "idempotent POST with key may retry", "RETRY"],
  ["error_surface", "timeout has safe customer wording", "SAFE"],
  ["error_surface", "429 has safe customer wording", "SAFE"],
  ["error_surface", "provider 500 has no internals", "SAFE"],
  ["error_surface", "credential failure does not expose secret", "SAFE"],
  ["error_surface", "oversized response has bounded error", "SAFE"],
  ["durable_write", "prepared can dispatch", "VALID"],
  ["durable_write", "in-flight can succeed", "VALID"],
  ["durable_write", "unknown outcome can reconcile", "VALID"],
  ["durable_write", "succeeded cannot dispatch again", "INVALID"],
  ["durable_write", "failed cannot become succeeded directly", "INVALID"],
  ["worker_lease", "prepared turn dispatches", "DISPATCH"],
  ["worker_lease", "active lease is not dispatched twice", "WAIT"],
  ["worker_lease", "expired lease is recoverable", "DISPATCH"],
  ["worker_lease", "succeeded record is never dispatched", "WAIT"],
  ["worker_lease", "unknown outcome is reconciled, not blind retried", "WAIT"],
  ["upload_limits", "5MB file is accepted by contract", "ACCEPT"],
  ["upload_limits", "file above 5MB is rejected by contract", "REJECT"],
  ["upload_limits", "attachment extraction is capped", "CAP"],
  ["upload_limits", "unsafe marker in filename is sanitized", "SANITIZE"],
  ["upload_limits", "missing extraction remains explicit", "EMPTY"],
  ["webhook_identity", "event id is stable when supplied", "STABLE"],
  ["webhook_identity", "event without id gets deterministic fallback", "STABLE"],
  ["webhook_identity", "reference is normalized", "NORMALIZED"],
  ["webhook_identity", "subscription token is extracted", "EXTRACTED"],
  ["webhook_identity", "invalid JSON fails before processing", "REJECT"],
  ["realtime_scale", "production requires realtime secret", "REQUIRED"],
  ["realtime_scale", "production requires Redis URL", "REQUIRED"],
  ["realtime_scale", "connection limits are positive", "BOUNDED"],
  ["realtime_scale", "worker retry and DLQ settings are positive", "BOUNDED"],
  ["realtime_scale", "event size is bounded", "BOUNDED"],
  ["tenant_fairness", "tenant ids remain present in fixtures", "ISOLATED"],
  ["tenant_fairness", "same customer does not alter workspace scope", "ISOLATED"],
  ["tenant_fairness", "rate limit key can include tenant", "ISOLATED"],
  ["tenant_fairness", "unique tenant burst does not share a key", "FAIR"],
  ["tenant_fairness", "catalog has multiple workspaces", "DIVERSE"],
];

export const PROVIDER_A12_CASES = Object.freeze(
  scenarios.map(([category, name, expected], index) => {
    const tenant = TENANT_FIXTURES[index % TENANT_FIXTURES.length];
    return {
      id: `A12-${String(index + 1).padStart(3, "0")}`,
      category,
      name,
      expected,
      workspaceId: tenant.workspaceId,
      agentId: tenant.agentId,
      customerId: tenant.customerId,
      preconditions: ["synthetic provider/worker fixture only"],
      cleanup: ["no remote side effect"],
    };
  })
);

export function validateProviderA12Catalog(input = PROVIDER_A12_CASES) {
  if (!Array.isArray(input) || input.length !== 40) {
    throw new Error(`A12 requires exactly 40 cases; received ${input?.length || 0}`);
  }
  const ids = new Set();
  for (const item of input) {
    if (!/^A12-\d{3}$/.test(item.id) || ids.has(item.id)) {
      throw new Error(`Invalid or duplicate A12 id: ${item.id}`);
    }
    ids.add(item.id);
    for (const field of ["category", "workspaceId", "agentId", "customerId", "expected"]) {
      if (!(field in item)) throw new Error(`${item.id} missing ${field}`);
    }
  }
  const counts = Object.fromEntries(groups.map((group) => [group, input.filter((item) => item.category === group).length]));
  if (Object.values(counts).some((count) => count !== 5)) {
    throw new Error(`A12 category counts must be 5 each: ${JSON.stringify(counts)}`);
  }
  return { count: input.length, categories: counts, version: PROVIDER_A12_FIXTURE_VERSION };
}
