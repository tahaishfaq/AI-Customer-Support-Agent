import {
  normalizeTaskDefinition,
  readTaskPath,
} from "./task-contract.js";

function resultStatus(result) {
  if (result?.capabilityResult?.status) return result.capabilityResult.status;
  if (result?.status === "OK" || result?.status === "SUCCEEDED") return "ok";
  return String(result?.status || "error").toLowerCase();
}

function isSuccess(result) {
  return resultStatus(result) === "ok";
}

function boundArgs(step, completed) {
  const args = { ...step.args };
  for (const binding of step.bindings) {
    const dependency = completed.get(String(binding.fromStepId));
    if (!dependency || !isSuccess(dependency)) {
      const error = new Error(`Dependency ${binding.fromStepId} did not succeed`);
      error.code = "DEPENDENCY_FAILED";
      throw error;
    }
    const value = readTaskPath(
      dependency.data ?? dependency.result ?? dependency,
      binding.fromPath
    );
    if (value === undefined || value === null) {
      const error = new Error(`Missing dependency output: ${binding.fromStepId}.${binding.fromPath || "value"}`);
      error.code = "DEPENDENCY_OUTPUT_MISSING";
      throw error;
    }
    args[String(binding.toArg)] = value;
  }
  return args;
}

function safeStepRecord(step, result, startedAt, finishedAt) {
  return {
    stepId: step.id,
    actionRevisionId: step.actionRevisionId,
    actionName: step.actionName,
    status: resultStatus(result),
    code: result?.code || result?.errorCode || null,
    httpStatus: result?.httpStatus ?? result?.meta?.httpStatus ?? null,
    startedAt,
    finishedAt,
  };
}

export async function runBoundedTask(definition, {
  invokeStep,
  onStep,
  signal,
  customerSubject = null,
  now = () => Date.now(),
} = {}) {
  if (typeof invokeStep !== "function") throw new Error("invokeStep is required");
  const task = normalizeTaskDefinition(definition);
  if (task.requiredIdentity !== "NONE" && !customerSubject) {
    return { status: "PAUSED", code: "IDENTITY_REQUIRED", records: [] };
  }
  const startedAt = now();
  const completed = new Map();
  const records = [];
  let httpCalls = 0;

  const persist = async (record) => {
    records.push(record);
    if (typeof onStep === "function") await onStep(record);
  };

  while (completed.size < task.steps.length) {
    if (signal?.aborted) return { status: "PAUSED", code: "ABORTED", records };
    const elapsed = now() - startedAt;
    if (elapsed > task.budgets.lifetimeMs || elapsed > task.budgets.activeDeadlineMs) {
      return { status: "FAILED", code: "TASK_DEADLINE", records };
    }
    if (httpCalls >= task.budgets.maxHttpCalls) {
      return { status: "FAILED", code: "TASK_HTTP_BUDGET", records };
    }

    const ready = task.steps.filter((step) =>
      !completed.has(step.id) && step.dependsOn.every((dependency) => completed.has(dependency))
    );
    if (!ready.length) return { status: "FAILED", code: "TASK_DEPENDENCY_CYCLE", records };

    const reads = ready.filter((step) => step.kind === "READ").slice(0, task.budgets.maxParallel);
    const batch = reads.length ? reads : [ready[0]];
    const outcomes = await Promise.all(batch.map(async (step) => {
      const started = now();
      let result;
      try {
        result = await invokeStep({
          step,
          args: boundArgs(step, completed),
          completed,
        });
      } catch (error) {
        result = { status: "error", code: error.code || "TASK_STEP_FAILED" };
      }
      httpCalls += 1;
      const record = safeStepRecord(step, result, started, now());
      await persist(record);
      return { step, result, record };
    }));

    for (const { step, result } of outcomes) {
      const status = resultStatus(result);
      if (status === "needs_user") {
        return { status: "PAUSED", code: result.code || "NEEDS_USER", records };
      }
      if (status === "escalate") {
        return { status: "ESCALATED", code: result.code || "ESCALATE", records };
      }
      if (!isSuccess(result)) {
        const handoff = task.failurePolicy.onFailure === "handoff";
        return {
          status: handoff ? "ESCALATED" : "FAILED",
          code: result?.code || result?.errorCode || "TASK_STEP_FAILED",
          failedStepId: step.id,
          records,
        };
      }
      completed.set(step.id, result);
    }
  }

  return { status: "SUCCEEDED", code: "TASK_OK", records };
}
