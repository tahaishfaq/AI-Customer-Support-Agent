export const DEFAULT_TASK_BUDGETS = Object.freeze({
  maxModelIterations: 5,
  maxHttpCalls: 8,
  maxParallel: 2,
  activeDeadlineMs: 25_000,
  lifetimeMs: 120_000,
});

const PATH_RE = /^[A-Za-z][A-Za-z0-9_.-]*$/;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function readTaskPath(value, path) {
  if (!path) return value;
  return String(path)
    .split(".")
    .reduce((current, key) => (current == null ? undefined : current[key]), value);
}

export function normalizeTaskDefinition(definition) {
  if (!asObject(definition)) throw new Error("Task definition must be an object");
  const steps = Array.isArray(definition.steps) ? definition.steps : [];
  if (!steps.length || steps.length > 20) {
    throw new Error("Task must contain between 1 and 20 steps");
  }
  const ids = new Set();
  const normalizedSteps = steps.map((raw, index) => {
    if (!asObject(raw)) throw new Error(`Invalid task step at index ${index}`);
    const id = String(raw.id || `step_${index + 1}`).trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id) || ids.has(id)) {
      throw new Error(`Invalid or duplicate task step id: ${id}`);
    }
    ids.add(id);
    const kind = String(raw.kind || "READ").toUpperCase();
    if (kind !== "READ" && kind !== "WRITE") {
      throw new Error(`Invalid task step kind: ${kind}`);
    }
    const dependsOn = Array.isArray(raw.dependsOn)
      ? [...new Set(raw.dependsOn.map((value) => String(value)))]
      : [];
    const bindings = Array.isArray(raw.bindings) ? raw.bindings : [];
    for (const binding of bindings) {
      if (!asObject(binding) || !binding.fromStepId || !binding.toArg) {
        throw new Error(`Invalid binding in task step: ${id}`);
      }
      if (binding.fromPath && !PATH_RE.test(String(binding.fromPath))) {
        throw new Error(`Invalid binding path in task step: ${id}`);
      }
    }
    return {
      id,
      actionRevisionId: raw.actionRevisionId ? String(raw.actionRevisionId) : null,
      actionName: raw.actionName ? String(raw.actionName) : null,
      kind,
      dependsOn,
      bindings,
      args: asObject(raw.args) ? raw.args : {},
      requiresConfirmation: Boolean(raw.requiresConfirmation),
    };
  });

  const stepIds = new Set(normalizedSteps.map((step) => step.id));
  const allowedActionRevisions = Array.isArray(definition.allowedActionRevisions)
    ? definition.allowedActionRevisions.map(String)
    : [];
  for (const step of normalizedSteps) {
    if (
      step.actionRevisionId &&
      allowedActionRevisions.length &&
      !allowedActionRevisions.includes(step.actionRevisionId)
    ) {
      throw new Error(`Task step uses an action revision outside the allowlist: ${step.id}`);
    }
  }
  for (const step of normalizedSteps) {
    for (const dependency of step.dependsOn) {
      if (!stepIds.has(dependency) || dependency === step.id) {
        throw new Error(`Unknown task dependency: ${dependency}`);
      }
    }
  }

  const budgets = {
    ...DEFAULT_TASK_BUDGETS,
    ...(asObject(definition.budgets) ? definition.budgets : {}),
  };
  for (const key of Object.keys(DEFAULT_TASK_BUDGETS)) {
    budgets[key] = Math.max(1, Number(budgets[key]) || DEFAULT_TASK_BUDGETS[key]);
  }
  budgets.maxParallel = Math.min(budgets.maxParallel, 8);
  budgets.maxHttpCalls = Math.min(budgets.maxHttpCalls, 50);
  return {
    id: definition.id ? String(definition.id) : null,
    name: String(definition.name || "task"),
    requiredIdentity: String(definition.requiredIdentity || "NONE").toUpperCase(),
    allowedActionRevisions,
    failurePolicy: asObject(definition.failurePolicy)
      ? definition.failurePolicy
      : { onFailure: "stop" },
    budgets,
    steps: normalizedSteps,
  };
}

export function matchTaskToolResults(toolCalls, toolResults) {
  const calls = Array.isArray(toolCalls) ? toolCalls : [];
  const results = new Map(
    (Array.isArray(toolResults) ? toolResults : []).map((result) => [
      String(result?.toolCallId || result?.id || ""),
      result,
    ])
  );
  return calls.map((call) => ({
    toolCallId: String(call?.id || ""),
    result: results.get(String(call?.id || "")) || null,
  }));
}
