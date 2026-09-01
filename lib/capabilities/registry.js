/**
 * O01-O2/O4 — Capability Registry: HTTP + MCP + built-ins → CapabilityDescriptor[].
 */
import prisma from "@/lib/prisma";
import { listEnabledMcpToolsForAgent } from "@/lib/services/mcp.service";
import { toCapabilityDescriptor } from "@/lib/capabilities/descriptor";
import { listBuiltinActionsForAgent } from "@/lib/capabilities/builtins";

export { toCapabilityDescriptor } from "@/lib/capabilities/descriptor";

/**
 * Load enabled capabilities for an agent (kill-switch aware).
 * Built-ins (handoff / meta) stay available even when HTTP/MCP actions are disabled.
 * @returns {Promise<{
 *   descriptors: import("./descriptor.js").CapabilityDescriptor[],
 *   actions: Array,
 *   workspaceId: string|null,
 * }>}
 */
export async function listCapabilitiesForAgent(agentId) {
  if (!agentId) {
    return { descriptors: [], actions: [], workspaceId: null };
  }
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { actionsEnabled: true, workspaceId: true },
  });
  if (!agent) {
    return { descriptors: [], actions: [], workspaceId: null };
  }

  const builtins = listBuiltinActionsForAgent(agentId);

  if (agent.actionsEnabled === false) {
    return {
      descriptors: builtins.map(toCapabilityDescriptor),
      actions: builtins,
      workspaceId: agent.workspaceId ?? null,
    };
  }

  const [httpActions, mcpTools] = await Promise.all([
    prisma.agentAction.findMany({
      where: { agentId, enabled: true },
      orderBy: { createdAt: "asc" },
    }),
    listEnabledMcpToolsForAgent(agentId),
  ]);
  const actions = [...builtins, ...httpActions, ...mcpTools];
  return {
    descriptors: actions.map(toCapabilityDescriptor),
    actions,
    workspaceId: agent.workspaceId,
  };
}
