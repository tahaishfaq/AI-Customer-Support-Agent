/**
 * Pure Agent Trace formatters — no Prisma / secrets / provider bodies.
 */

export const TRACE_FORBIDDEN_KEYS = Object.freeze([
  "body",
  "bodyText",
  "resultForModel",
  "plaintext",
  "ciphertext",
  "secret",
  "headers",
  "headersJson",
  "provider",
  "raw",
  "choices",
  "completion",
  "chatCompletion",
]);

const PREVIEW_CHARS = 160;

/**
 * Truncate message content for owner/admin debugging — not a full transcript dump.
 * @param {string|null|undefined} content
 */
export function previewMessageContent(content) {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= PREVIEW_CHARS) return text;
  return `${text.slice(0, PREVIEW_CHARS)}…`;
}

/**
 * Fail closed if a payload still contains forbidden provider/secret fields.
 * @param {unknown} value
 */
export function assertTracePayloadSafe(value, path = "trace") {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertTracePayloadSafe(item, `${path}[${i}]`));
    return value;
  }
  for (const [key, child] of Object.entries(value)) {
    if (TRACE_FORBIDDEN_KEYS.includes(key)) {
      const err = new Error(`Trace payload must not include ${key}`);
      err.code = "TRACE_PLAINTEXT_LEAK";
      err.path = `${path}.${key}`;
      throw err;
    }
    assertTracePayloadSafe(child, `${path}.${key}`);
  }
  return value;
}

/**
 * Synthesize activity phases from persisted turn + tool rows (SSE is not stored).
 */
export function buildActivityPhasesFromTrace({ turn, toolRuns = [] }) {
  const phases = [];
  let sequence = 0;
  const push = (partial) => {
    sequence += 1;
    phases.push({
      kind: "agent_activity",
      turnId: turn.id,
      activityId: partial.activityId,
      sequence,
      mode: partial.mode,
      phase: partial.phase,
      label: partial.label,
      ...(partial.errorCode ? { errorCode: partial.errorCode } : {}),
      ...(partial.durationMs != null ? { durationMs: partial.durationMs } : {}),
      ...(partial.toolRunId ? { toolRunId: partial.toolRunId } : {}),
      at: partial.at || null,
    });
  };

  push({
    activityId: "turn-accepted",
    mode: "preparation",
    phase: "running",
    label: "Turn accepted",
    at: turn.startedAt,
  });

  for (const run of toolRuns) {
    const status = String(run.status || "").toUpperCase();
    const failed =
      status.includes("ERROR") ||
      status === "TIMEOUT" ||
      status === "SSRF_BLOCKED" ||
      Boolean(run.errorCode);
    push({
      activityId: `tool-${run.id}`,
      mode: "http",
      phase: failed ? "failed" : "completed",
      label: run.actionName ? `Tool ${run.actionName}` : "Tool step",
      errorCode: run.errorCode || null,
      durationMs: run.durationMs ?? null,
      toolRunId: run.id,
      at: run.createdAt,
    });
  }

  const terminal =
    turn.status === "FAILED"
      ? "failed"
      : turn.status === "ESCALATED"
        ? "completed"
        : turn.status === "PAUSED"
          ? "failed"
          : "completed";
  push({
    activityId: "turn-finished",
    mode: "preparation",
    phase: terminal,
    label: `Turn ${String(turn.status || "COMPLETED").toLowerCase()}`,
    errorCode: turn.errorCode || null,
    at: turn.finishedAt || turn.lastHeartbeatAt || null,
  });

  return phases;
}

function serializeToolRunForTrace(run) {
  const errorCode = run.errorCode || null;
  const policyCodes = new Set([
    "IDENTITY_PROOF_REQUIRED",
    "IDENTITY_REQUIRED",
    "END_USER_TOKEN_REQUIRED",
    "CONFIRMATION_REQUIRED",
    "ACCOUNT_TOOL_MISCONFIGURED",
    "CROSS_USER_DENIED",
    "ORDER_OWNERSHIP_DENIED",
    "ORDER_OWNERSHIP_UNPROVEN",
  ]);
  return {
    id: run.id,
    actionId: run.actionId || null,
    actionName: run.action?.name || run.actionName || null,
    mcpToolId: run.mcpToolId || null,
    status: run.status,
    durationMs: run.durationMs ?? null,
    httpStatus: run.httpStatus ?? null,
    errorCode,
    errorCategory: run.errorCategory || null,
    policyOutcome: errorCode && policyCodes.has(String(errorCode))
      ? String(errorCode)
      : null,
    confirmationRequired: errorCode === "CONFIRMATION_REQUIRED",
    requestId: run.requestId || null,
    turnRunId: run.turnRunId || null,
    createdAt: run.createdAt,
  };
}

function serializeMessageForTrace(message) {
  return {
    id: message.id,
    role: message.role,
    clientMessageId: message.clientMessageId || null,
    responseTime: message.responseTime ?? null,
    contentPreview: previewMessageContent(message.content),
    contentTruncated:
      String(message.content || "").trim().length > PREVIEW_CHARS,
    createdAt: message.createdAt,
  };
}

function serializeTurnForTrace(turn) {
  return {
    id: turn.id,
    agentId: turn.agentId,
    conversationId: turn.conversationId,
    workspaceId: turn.workspaceId || null,
    clientMessageId: turn.clientMessageId || null,
    requestId: turn.requestId || null,
    status: turn.status,
    errorCode: turn.errorCode || null,
    ownershipVersion: turn.ownershipVersion,
    startedAt: turn.startedAt,
    finishedAt: turn.finishedAt || null,
    lastHeartbeatAt: turn.lastHeartbeatAt,
    createdAt: turn.createdAt,
  };
}

/**
 * @param {{ turn: object, toolRuns?: object[], messages?: object[] }} parts
 */
export function assembleAgentTurnTrace(parts) {
  const turn = serializeTurnForTrace(parts.turn);
  const toolRuns = (parts.toolRuns || []).map(serializeToolRunForTrace);
  const messages = (parts.messages || []).map(serializeMessageForTrace);
  const activities = buildActivityPhasesFromTrace({
    turn: parts.turn,
    toolRuns: (parts.toolRuns || []).map((run) => ({
      id: run.id,
      status: run.status,
      actionName: run.action?.name || run.actionName || null,
      durationMs: run.durationMs,
      errorCode: run.errorCode,
      createdAt: run.createdAt,
    })),
  });

  const trace = {
    turn,
    toolRuns,
    messages,
    activities,
    meta: {
      reconstructed: true,
      includesProviderBodies: false,
      activitySource: "synthesized_from_tool_runs",
    },
  };
  return assertTracePayloadSafe(trace);
}
