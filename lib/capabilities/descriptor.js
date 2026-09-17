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
 *   entities: string[],
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
    entities: Array.isArray(action?.entities)
      ? action.entities
      : inferCapabilityEntities(action),
    sourceRef: {
      type: isBuiltin ? "builtin" : isMcp ? "mcp_tool" : "agent_action",
      id: String(action?._builtin?.id || action?.id || ""),
    },
  };
}

/**
 * Keep entity hints descriptive only. They narrow model-visible capabilities;
 * the gateway remains the authority for tenant, identity, and permissions.
 * @param {{name?: string, description?: string}} action
 * @returns {string[]}
 */
export function inferCapabilityEntities(action) {
  const text = `${String(action?.name || "")} ${String(action?.description || "")}`.toLowerCase();
  const entities = [];
  if (/\b(plan|plans|pricing|price|prices|cost|package|packages|subscription)\b/.test(text)) entities.push("PLANS");
  if (/\b(sign[ -]?up|register|registration|create an account|open an account)\b/.test(text)) entities.push("SIGNUP");
  if (/\b(maintenance|service status|outage|downtime)\b/.test(text)) entities.push("MAINTENANCE");
  if (/\b(order|shipping|tracking|refund|return|ticket|appointment|booking)\b/.test(text)) entities.push("SUPPORT");
  return entities;
}
