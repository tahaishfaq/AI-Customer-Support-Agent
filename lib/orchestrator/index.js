/**
 * O01-O3 — Orchestrator entry: runTurn(ctx) → TurnResult.
 * Channel builds AgentContext; Orchestrator owns the loop.
 */

import { MAX_TOOL_STEPS } from "@/lib/actions/action-config";
import { runOrchestratorLoop } from "@/lib/orchestrator/loop";
import { safeLog } from "@/lib/observability/safe-log";

/**
 * @typedef {object} AgentContext
 * @property {string} [requestId]
 * @property {string} agentId
 * @property {string|null} [workspaceId]
 * @property {string|null} [conversationId]
 * @property {string} [channel]
 * @property {string} [userMessage]
 * @property {Array<{ role: string, content: string }>} history
 * @property {string} systemPrompt
 * @property {string|null} [knowledgeBlock]
 * @property {{ customerSubject?: string|null, endUserAccessToken?: string|null }} [identity]
 * @property {{ publicAccess?: boolean, actionsEnabled?: boolean, streaming?: boolean }} [flags]
 * @property {AbortSignal} [signal]
 * @property {Array} [actions] — invoke targets (HTTP/MCP action rows)
 * @property {Array|null} [descriptors] — OpenAI tool descriptors from registry
 * @property {number} [maxSteps]
 * @property {(ev: { type: string, data: object }) => void} [onEvent] — O3.1 SSE (delta/tool)
 */

/**
 * @typedef {object} TurnResult
 * @property {string} assistantText
 * @property {Array} toolSteps
 * @property {Array} clientActions
 * @property {boolean} degraded
 * @property {number|null} latencyMs
 * @property {"final"|"needs_user"|"max_steps"|"escalate"|"aborted"} stopReason
 */

/**
 * Count capability kinds offered this turn (no names/payloads).
 * @param {Array} actions
 */
function capabilityCounts(actions = []) {
  let builtin = 0;
  let mcp = 0;
  let http = 0;
  for (const a of actions) {
    if (a?._builtin) builtin += 1;
    else if (a?._mcp) mcp += 1;
    else http += 1;
  }
  return { builtin, mcp, http, total: actions.length };
}

/**
 * Run one orchestrator turn.
 * @param {AgentContext} ctx
 * @returns {Promise<TurnResult>}
 */
export async function runTurn(ctx) {
  if (!ctx || typeof ctx !== "object") {
    throw new Error("runTurn requires AgentContext");
  }
  if (!ctx.agentId) {
    throw new Error("runTurn requires agentId");
  }
  if (!ctx.systemPrompt) {
    throw new Error("runTurn requires systemPrompt");
  }

  const identity = ctx.identity || {};
  const flags = ctx.flags || {};
  const actions = Array.isArray(ctx.actions) ? ctx.actions : [];
  const actionsEnabled =
    flags.actionsEnabled !== false && actions.length > 0;
  const offered = actionsEnabled ? actions : [];
  const counts = capabilityCounts(offered);

  const result = await runOrchestratorLoop({
    system: ctx.systemPrompt,
    messages: Array.isArray(ctx.history) ? ctx.history : [],
    actions: offered,
    descriptors: actionsEnabled ? ctx.descriptors ?? null : null,
    signal: ctx.signal,
    agentId: ctx.agentId,
    workspaceId: ctx.workspaceId ?? null,
    conversationId: ctx.conversationId ?? null,
    requestId: ctx.requestId ?? null,
    customerSubject: identity.customerSubject ?? null,
    endUserAccessToken: identity.endUserAccessToken ?? null,
    publicAccess: Boolean(flags.publicAccess),
    lastUserMessage: ctx.userMessage ?? null,
    maxSteps: ctx.maxSteps ?? MAX_TOOL_STEPS,
    streaming: Boolean(flags.streaming),
    onEvent: typeof ctx.onEvent === "function" ? ctx.onEvent : null,
  });

  // Observability — no payloads / transcripts
  safeLog("info", "orchestrator.turn", {
    requestId: ctx.requestId,
    agentId: ctx.agentId,
    conversationId: ctx.conversationId,
    route: ctx.channel || null,
    durationMs: result.latencyMs,
    stopReason: result.stopReason,
    capabilityCount: counts.total,
    capabilityBuiltin: counts.builtin,
    capabilityMcp: counts.mcp,
    capabilityHttp: counts.http,
    toolStepCount: Array.isArray(result.toolSteps) ? result.toolSteps.length : 0,
    clientActionCount: Array.isArray(result.clientActions)
      ? result.clientActions.length
      : 0,
    code: "ORCHESTRATOR_TURN",
  });

  return result;
}

export { runOrchestratorLoop } from "@/lib/orchestrator/loop";
export {
  stopReasonFromStep,
  stopReasonFromSteps,
  clientActionsFromSteps,
} from "@/lib/orchestrator/stop-rules";
export { mapPolicyCodeToCapability, POLICY_CODE_MAP } from "@/lib/orchestrator/map-policy";
