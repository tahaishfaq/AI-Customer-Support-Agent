import assert from "node:assert/strict";
import { matchTaskToolResults, normalizeTaskDefinition } from "../lib/orchestrator/task-contract.js";
import { runBoundedTask } from "../lib/orchestrator/task-runner.js";

const base = {
  name: "order_and_delivery",
  allowedActionRevisions: ["order-r1", "delivery-r1"],
  steps: [
    { id: "order", actionRevisionId: "order-r1", actionName: "get_order", kind: "READ" },
    {
      id: "delivery",
      actionRevisionId: "delivery-r1",
      actionName: "get_delivery",
      kind: "READ",
      dependsOn: ["order"],
      bindings: [{ fromStepId: "order", fromPath: "deliveryId", toArg: "deliveryId" }],
    },
  ],
};

const sequence = [];
const dependent = await runBoundedTask(base, {
  invokeStep: async ({ step, args }) => {
    sequence.push(step.id);
    return step.id === "order"
      ? { status: "ok", data: { deliveryId: "DEL-1" } }
      : { status: "ok", data: { deliveryId: args.deliveryId, eta: "Today" } };
  },
});
assert.equal(dependent.status, "SUCCEEDED");
assert.deepEqual(sequence, ["order", "delivery"]);

let active = 0;
let peak = 0;
const parallel = await runBoundedTask({
  ...base,
  steps: [
    { id: "a", actionRevisionId: "order-r1", kind: "READ" },
    { id: "b", actionRevisionId: "delivery-r1", kind: "READ" },
  ],
  budgets: { maxParallel: 2 },
}, {
  invokeStep: async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return { status: "ok", data: {} };
  },
});
assert.equal(parallel.status, "SUCCEEDED");
assert.equal(peak, 2);

const writes = [];
const sequentialWrites = await runBoundedTask({
  ...base,
  budgets: { maxParallel: 8 },
  steps: [
    { id: "write1", actionRevisionId: "order-r1", kind: "WRITE" },
    { id: "write2", actionRevisionId: "delivery-r1", kind: "WRITE" },
  ],
}, {
  invokeStep: async ({ step }) => {
    writes.push(step.id);
    return { status: "ok", data: {} };
  },
});
assert.equal(sequentialWrites.status, "SUCCEEDED");
assert.deepEqual(writes, ["write1", "write2"]);

const paused = await runBoundedTask({
  ...base,
  steps: [{ id: "confirm", actionRevisionId: "order-r1", kind: "WRITE" }],
}, {
  invokeStep: async () => ({ status: "needs_user", code: "CONFIRMATION_REQUIRED" }),
});
assert.deepEqual({ status: paused.status, code: paused.code }, {
  status: "PAUSED",
  code: "CONFIRMATION_REQUIRED",
});

const failed = await runBoundedTask({
  ...base,
  failurePolicy: { onFailure: "handoff" },
  steps: [{ id: "lookup", actionRevisionId: "order-r1", kind: "READ" }],
}, {
  invokeStep: async () => ({ status: "error", code: "UPSTREAM_FAILED" }),
});
assert.deepEqual({ status: failed.status, code: failed.code }, {
  status: "ESCALATED",
  code: "UPSTREAM_FAILED",
});

const matched = matchTaskToolResults(
  [{ id: "call-a" }, { id: "call-b" }],
  [{ toolCallId: "call-b", status: "ok" }]
);
assert.equal(matched[0].result, null);
assert.equal(matched[1].result.status, "ok");

assert.throws(
  () => normalizeTaskDefinition({ steps: [{ id: "x", dependsOn: ["missing"] }] }),
  /Unknown task dependency/
);
assert.throws(
  () => normalizeTaskDefinition({ allowedActionRevisions: ["allowed-r1"], steps: [{ id: "x", actionRevisionId: "other-r1" }] }),
  /outside the allowlist/
);

console.log("HTTP tools Phase 7 bounded task checks passed");
