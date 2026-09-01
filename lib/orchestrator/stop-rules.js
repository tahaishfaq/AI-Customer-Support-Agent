/**
 * O01-O3 — When the turn loop should stop after a capability result.
 */

/** @typedef {"final"|"needs_user"|"max_steps"|"escalate"|"aborted"} StopReason */

/**
 * @param {{ capabilityResult?: { status?: string } }|null|undefined} step
 * @returns {"needs_user"|"escalate"|null}
 */
export function stopReasonFromStep(step) {
  const status = step?.capabilityResult?.status;
  if (status === "needs_user") return "needs_user";
  if (status === "escalate") return "escalate";
  return null;
}

/**
 * First hard-stop reason in a batch of tool steps (needs_user wins over escalate if both).
 * @param {Array<{ capabilityResult?: { status?: string } }>} steps
 * @returns {"needs_user"|"escalate"|null}
 */
export function stopReasonFromSteps(steps = []) {
  let escalate = null;
  for (const step of steps) {
    const reason = stopReasonFromStep(step);
    if (reason === "needs_user") return "needs_user";
    if (reason === "escalate") escalate = "escalate";
  }
  return escalate;
}

/**
 * Collect non-none forClient actions from steps (dedupe confirm by id).
 * @param {Array<{ capabilityResult?: { forClient?: object } }>} steps
 */
export function clientActionsFromSteps(steps = []) {
  const out = [];
  const seenConfirm = new Set();
  for (const step of steps) {
    const fc = step?.capabilityResult?.forClient;
    if (!fc || typeof fc !== "object") continue;
    const type = fc.type;
    if (!type || type === "none") continue;
    if (type === "confirm") {
      const id = fc.payload?.id;
      if (id && seenConfirm.has(id)) continue;
      if (id) seenConfirm.add(id);
    }
    out.push(fc);
  }
  return out;
}
