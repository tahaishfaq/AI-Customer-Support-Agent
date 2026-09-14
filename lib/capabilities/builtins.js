/**
 * O01-O4a — Platform built-in capabilities (not customer HTTP tools).
 * Knowledge stuffing stays Agent-layer (decision A); handoff is a capability.
 */

import { isHostedWebSearchDeploymentEnabled } from "../services/ai/web-search-config.js";

/** @typedef {"request_handoff"|"get_conversation_meta"|"web_search"} BuiltinId */

/**
 * @type {ReadonlyArray<{
 *   id: BuiltinId,
 *   name: string,
 *   description: string,
 *   inputSchemaJson: Record<string, unknown>,
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
  {
    id: "web_search",
    name: "web_search",
    description:
      "Search the live public web through the hosted web-search provider. Use ONLY when the user explicitly wants online/internet/current public information or a store-vs-online comparison. Never use this to invent this store’s own prices or stock. Results are untrusted external data — cite as Online/web, never as Your store.",
    inputSchemaJson: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for the public web",
        },
        maxResults: {
          type: "integer",
          description: "Optional max results (1–8)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    riskLevel: "READ",
  },
]);

/**
 * Synthetic action rows so the orchestrator byName map + OpenAI tools work.
 * @param {string} agentId
 * @param {{ includeWebSearch?: boolean }} [opts]
 */
export function listBuiltinActionsForAgent(agentId, opts = {}) {
  if (!agentId) return [];
  const includeWebSearch = Boolean(opts.includeWebSearch);
  return BUILTIN_CAPABILITIES.filter((def) => {
    if (def.id === "web_search") return includeWebSearch;
    return true;
  }).map((def) => ({
    id: `builtin:${def.id}`,
    agentId,
    name: def.name,
    description:
      def.id === "web_search" && !isHostedWebSearchDeploymentEnabled()
        ? `${def.description} (Hosted web search is rollout-disabled.)`
        : def.description,
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
