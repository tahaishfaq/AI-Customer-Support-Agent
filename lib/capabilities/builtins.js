/**
 * O01-O4a — Platform built-in capabilities (not customer HTTP tools).
 * Knowledge stuffing stays Agent-layer (decision A); handoff is a capability.
 */

/** @typedef {"request_handoff"|"get_conversation_meta"} BuiltinId */

/**
 * @type {ReadonlyArray<{
 *   id: BuiltinId,
 *   name: string,
 *   description: string,
 *   inputSchemaJson: Record<string, string>,
 *   riskLevel: string,
 * }>}
 */
export const BUILTIN_CAPABILITIES = Object.freeze([
  {
    id: "request_handoff",
    name: "request_handoff",
    description:
      "Escalate this conversation to a human teammate when you cannot resolve the issue from knowledge or tools. Use only after a clear attempt to help. Provide a short reason and optional summary.",
    inputSchemaJson: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why a human is needed" },
        summary: {
          type: "string",
          description: "Optional short context for the teammate",
        },
      },
      required: ["reason"],
      additionalProperties: false,
    },
    riskLevel: "READ",
  },
  {
    id: "get_conversation_meta",
    name: "get_conversation_meta",
    description:
      "Read safe conversation metadata (status, whether AI is paused / waiting for human). No message bodies or PII.",
    inputSchemaJson: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    riskLevel: "READ",
  },
]);

/**
 * Synthetic action rows so the orchestrator byName map + OpenAI tools work.
 * @param {string} agentId
 */
export function listBuiltinActionsForAgent(agentId) {
  if (!agentId) return [];
  return BUILTIN_CAPABILITIES.map((def) => ({
    id: `builtin:${def.id}`,
    agentId,
    name: def.name,
    description: def.description,
    enabled: true,
    riskLevel: def.riskLevel,
    accessClass: "GUEST",
    requiresIdentity: false,
    requiresConfirmation: false,
    identityMode: "NONE",
    inputSchemaJson: def.inputSchemaJson,
    version: 1,
    _builtin: { id: def.id },
  }));
}

/**
 * @param {unknown} action
 * @returns {boolean}
 */
export function isBuiltinAction(action) {
  return Boolean(action && typeof action === "object" && action._builtin?.id);
}
