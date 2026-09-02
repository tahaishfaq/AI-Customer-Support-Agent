/**
 * Pure CapabilityDescriptor mapping (no DB) — safe for Node unit tests.
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   kind: "http"|"mcp"|"builtin",
 *   description: string,
 *   inputSchema: unknown,
 *   riskLevel: string,
 *   accessClass: string|null,
 *   requiresIdentity: boolean,
 *   requiresConfirmation: boolean,
 *   identityMode: string|null,
 *   sourceRef: { type: "agent_action"|"mcp_tool"|"builtin", id: string },
 * }} CapabilityDescriptor
 */

/**
 * @param {object} action — AgentAction row or MCP synthetic action
 * @returns {CapabilityDescriptor}
 */
export function toCapabilityDescriptor(action) {
  const isMcp = Boolean(action?._mcp);
  const isBuiltin = Boolean(action?._builtin);
  return {
    id: String(action?.id || ""),
    name: String(action?.name || ""),
    kind: isBuiltin ? "builtin" : isMcp ? "mcp" : "http",
    description: String(action?.description || action?.name || "").slice(0, 500),
    inputSchema: action?.inputSchemaJson ?? {},
    riskLevel: String(action?.riskLevel || "READ").toUpperCase(),
    accessClass: action?.accessClass != null ? String(action.accessClass) : null,
    requiresIdentity: Boolean(action?.requiresIdentity),
    requiresConfirmation: Boolean(action?.requiresConfirmation),
    identityMode: action?.identityMode != null ? String(action.identityMode) : null,
    sourceRef: {
      type: isBuiltin ? "builtin" : isMcp ? "mcp_tool" : "agent_action",
      id: String(action?._builtin?.id || action?.id || ""),
    },
  };
}
