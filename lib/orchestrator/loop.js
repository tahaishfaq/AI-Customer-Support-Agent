/**
 * O01-O3 / O3.1 — Orchestrator tool loop (generic: plan → invoke → observe).
 * Domain rules stay in capabilities / services — not here.
 *
 * Streaming (O3.1): tool rounds stay non-stream; final user-facing text
 * streams via onEvent({ type: "delta" }). Tool progress via type: "tool".
 */

import {
  MAX_TOOL_STEPS,
  TOOL_LOOP_DEADLINE_MS,
} from "@/lib/actions/action-config";
import { actionsToOpenAiTools } from "@/lib/actions/tool-definitions";
import { orderToolCallsGetFirst } from "@/lib/actions/outbound-semaphore";
import { chatCompletionTurn } from "@/lib/services/ai/llm.provider";
import { invokeOneTool } from "@/lib/actions/invoke-tool";
import {
  clientActionsFromSteps,
  stopReasonFromSteps,
} from "@/lib/orchestrator/stop-rules";

const MAX_TOOL_RESULT_CHARS = 4000;
const DELTA_CHUNK = 24;

function truncateToolContent(text) {
  const s = String(text || "");
  if (s.length <= MAX_TOOL_RESULT_CHARS) return s;
  return `${s.slice(0, MAX_TOOL_RESULT_CHARS)}…`;
}

/**
 * Emit text as SSE-friendly delta chunks (when content already complete).
 * @param {string} text
 * @param {(ev: { type: string, data: object }) => void} [onEvent]
 */
function emitTextAsDeltas(text, onEvent) {
  if (!onEvent) return;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += DELTA_CHUNK) {
    onEvent({ type: "delta", data: { text: s.slice(i, i + DELTA_CHUNK) } });
  }
}

/**
 * Final / text-only turn: real token stream when streaming, else one shot.
 * @returns {Promise<string>}
 */
async function completeAssistantText({
  system,
  messages,
  signal,
  streaming,
  onEvent,
}) {
  if (streaming && typeof onEvent === "function") {
    const { chatCompletionStream } = await import(
      "@/lib/services/ai/llm.provider"
    );
    let content = "";
    for await (const delta of chatCompletionStream({
      system,
      messages,
      signal,
    })) {
      content += delta;
      onEvent({ type: "delta", data: { text: delta } });
    }
    return content.trim();
  }

  const turn = await chatCompletionTurn({ system, messages, signal });
  return String(turn.content || "").trim();
}

/**
 * @param {object} params
 * @param {(ev: { type: string, data: object }) => void} [params.onEvent]
 * @param {boolean} [params.streaming]
 * @returns {Promise<{
 *   assistantText: string,
 *   toolSteps: Array,
 *   clientActions: Array,
 *   degraded: boolean,
 *   latencyMs: number,
 *   stopReason: string,
 * }>}
 */
export async function runOrchestratorLoop({
  system,
  messages,
  actions = [],
  descriptors = null,
  signal,
  agentId,
  workspaceId = null,
  conversationId = null,
  requestId = null,
  customerSubject = null,
  endUserAccessToken = null,
  publicAccess = false,
  lastUserMessage = null,
  maxSteps = MAX_TOOL_STEPS,
  streaming = false,
  onEvent = null,
}) {
  const started = Date.now();
  const toolSource =
    Array.isArray(descriptors) && descriptors.length > 0 ? descriptors : actions;
  const tools = actionsToOpenAiTools(toolSource);
  const byName = new Map(actions.map((a) => [a.name, a]));
  const toolSteps = [];
  /** @type {string} */
  let stopReason = "final";
  const wantStream = Boolean(streaming && typeof onEvent === "function");

  if (!tools.length) {
    const content = await completeAssistantText({
      system,
      messages,
      signal,
      streaming: wantStream,
      onEvent,
    });
    if (!content) {
      const err = new Error("AI returned an empty reply");
      err.status = 502;
      throw err;
    }
    return {
      assistantText: content,
      toolSteps,
      clientActions: [],
      degraded: false,
      latencyMs: Date.now() - started,
      stopReason: "final",
    };
  }

  /** @type {Array<Record<string, unknown>>} */
  const loopMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let stepsUsed = 0;
  let hitLimit = false;

  while (stepsUsed < maxSteps) {
    if (signal?.aborted) {
      const err = new Error("Request cancelled");
      err.status = 499;
      err.details = { code: "ABORTED" };
      throw err;
    }
    if (Date.now() - started > TOOL_LOOP_DEADLINE_MS) {
      hitLimit = true;
      stopReason = "max_steps";
      break;
    }

    const turn = await chatCompletionTurn({
      system,
      messages: loopMessages,
      tools,
      signal,
    });

    if (!turn.toolCalls?.length) {
      const content = String(turn.content || "").trim();
      if (!content) {
        const err = new Error("AI returned an empty reply");
        err.status = 502;
        throw err;
      }
      // Text already complete from tool-enabled turn — chunk for live UI.
      if (wantStream) emitTextAsDeltas(content, onEvent);
      return {
        assistantText: content,
        toolSteps,
        clientActions: clientActionsFromSteps(toolSteps),
        degraded: false,
        latencyMs: Date.now() - started,
        stopReason: "final",
      };
    }

    loopMessages.push({
      role: "assistant",
      content: turn.content || null,
      tool_calls: turn.toolCalls,
    });

    const batchStart = toolSteps.length;

    for (const call of orderToolCallsGetFirst(turn.toolCalls, byName)) {
      if (stepsUsed >= maxSteps) {
        hitLimit = true;
        stopReason = "max_steps";
        break;
      }
      stepsUsed += 1;

      const name = call?.function?.name || "";
      const callId = call?.id || `call_${stepsUsed}`;

      if (wantStream) {
        onEvent({
          type: "tool",
          data: { name, status: "running", step: stepsUsed },
        });
      }

      const step = await invokeOneTool({
        name,
        argsRaw: call?.function?.arguments || "{}",
        byName,
        agentId,
        workspaceId,
        conversationId,
        requestId,
        customerSubject,
        endUserAccessToken,
        publicAccess,
        lastUserMessage,
        stepsUsed,
        maxSteps,
      });
      toolSteps.push(step);

      if (wantStream) {
        onEvent({
          type: "tool",
          data: {
            name: step.name || name,
            status: step.status || "done",
            errorCode: step.errorCode || null,
            step: stepsUsed,
          },
        });
      }

      loopMessages.push({
        role: "tool",
        tool_call_id: callId,
        content: truncateToolContent(step.resultForModel),
      });
    }

    const batch = toolSteps.slice(batchStart);
    const hardStop = stopReasonFromSteps(batch);
    if (hardStop) {
      stopReason = hardStop;
      break;
    }

    if (hitLimit) break;
  }

  if (stepsUsed >= maxSteps && stopReason === "final") {
    stopReason = "max_steps";
    hitLimit = true;
  }

  // Max steps / deadline / needs_user / escalate — one final text turn without tools
  const limitNote =
    stopReason === "needs_user"
      ? "A tool needs user action (confirm or sign-in). Tell the user clearly what to do next. Do not invent live API data."
      : stopReason === "escalate"
        ? "The conversation should escalate to a human. Acknowledge briefly and do not invent live API data."
        : "You have reached the tool-call limit or deadline. Answer the user from knowledge and tool results already available. If you still lack a required id or fact, ask a short clarifying question. Do not invent live API data.";

  let content = await completeAssistantText({
    system: `${system}\n\n${limitNote}`,
    messages: loopMessages,
    signal,
    streaming: wantStream,
    onEvent,
  });

  if (!content) {
    content =
      "I looked some things up but could not finish a clear answer. Please share any missing details (like an order id) and try again.";
    if (wantStream) emitTextAsDeltas(content, onEvent);
  }

  return {
    assistantText: content,
    toolSteps,
    clientActions: clientActionsFromSteps(toolSteps),
    degraded: false,
    latencyMs: Date.now() - started,
    stopReason: hitLimit && stopReason === "final" ? "max_steps" : stopReason,
  };
}
