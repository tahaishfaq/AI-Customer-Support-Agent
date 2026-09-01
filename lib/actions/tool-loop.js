/**
 * F11 — list enabled capabilities for chat (delegates to Capability Registry).
 * Turn loop: `import { runTurn } from "@/lib/orchestrator"`.
 */

import { listCapabilitiesForAgent } from "@/lib/capabilities/registry";

/**
 * Load enabled HTTP + MCP + built-in capabilities for an agent.
 * @returns {Promise<{ actions: Array, workspaceId: string|null, descriptors: Array }>}
 */
export async function listEnabledActionsForAgent(agentId) {
  return listCapabilitiesForAgent(agentId);
}

export { invokeOneTool } from "@/lib/actions/invoke-tool";
