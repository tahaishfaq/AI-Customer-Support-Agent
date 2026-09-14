import assert from "node:assert/strict";
import {
  assertWriteTransition,
  buildScopedWriteKey,
  buildWriteRequestFingerprint,
  canReconcile,
  classifyDispatchFailure,
  shouldDispatch,
} from "../lib/actions/durable-write.js";

const base = {
  workspaceId: "ws-1",
  principalScope: "customer:c-1",
  actionId: "action-1",
  actionRevisionId: "rev-3",
  method: "POST",
  resource: "/orders/1/cancel",
  resolvedBody: { reason: "duplicate", quantity: 1 },
};

const fp1 = buildWriteRequestFingerprint(base);
const fp2 = buildWriteRequestFingerprint({ ...base, resolvedBody: { quantity: 1, reason: "duplicate" } });
assert.equal(fp1, fp2, "fingerprint canonicalizes object key order");
assert.notEqual(fp1, buildWriteRequestFingerprint({ ...base, actionRevisionId: "rev-4" }), "revision is part of fingerprint");
assert.equal(buildScopedWriteKey({ ...base, logicalOperationId: "op-1", requestFingerprint: fp1 }), buildScopedWriteKey({ ...base, logicalOperationId: "op-1", requestFingerprint: fp1 }));
assert.notEqual(buildScopedWriteKey({ ...base, principalScope: "customer:c-2", logicalOperationId: "op-1", requestFingerprint: fp1 }), buildScopedWriteKey({ ...base, principalScope: "customer:c-1", logicalOperationId: "op-1", requestFingerprint: fp1 }));

assert.equal(shouldDispatch({ status: "PREPARED" }), true);
assert.equal(shouldDispatch({ status: "IN_FLIGHT", leaseUntil: new Date(Date.now() - 1_000) }), true);
assert.equal(shouldDispatch({ status: "IN_FLIGHT", leaseUntil: new Date(Date.now() + 60_000) }), false);
assert.equal(shouldDispatch({ status: "SUCCEEDED" }), false);

assertWriteTransition("PREPARED", "IN_FLIGHT");
assertWriteTransition("IN_FLIGHT", "OUTCOME_UNKNOWN");
assertWriteTransition("OUTCOME_UNKNOWN", "SUCCEEDED");
assert.throws(() => assertWriteTransition("SUCCEEDED", "IN_FLIGHT"));

assert.equal(classifyDispatchFailure({ responseReceived: false, transportError: true }), "OUTCOME_UNKNOWN");
assert.equal(classifyDispatchFailure({ responseReceived: true, transportError: true }), "RESPONSE_RECEIVED");
assert.equal(canReconcile("OUTCOME_UNKNOWN"), true);
assert.equal(canReconcile("FAILED"), false);

console.log("HTTP tools Phase 8 durable write checks passed");
