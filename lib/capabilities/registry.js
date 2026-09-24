/**
 * O01-O2/O4 — Capability Registry: HTTP + MCP + built-ins → CapabilityDescriptor[].
 */
import prisma from "@/lib/prisma";
import { listEnabledMcpToolsForAgent } from "@/lib/services/mcp.service";
import { inferCapabilityEntities, toCapabilityDescriptor } from "@/lib/capabilities/descriptor";
import { listBuiltinActionsForAgent } from "@/lib/capabilities/builtins";
import { isHostedWebSearchAllowed } from "@/lib/services/ai/web-search-config";
import { materializePublishedAction } from "@/lib/services/action-revision.service";

export { toCapabilityDescriptor } from "@/lib/capabilities/descriptor";

/**
 * Load enabled capabilities for an agent (kill-switch aware).
 * Built-ins (handoff / meta) stay available even when HTTP/MCP actions are disabled.
 * @returns {Promise<{
 *   descriptors: import("./descriptor.js").CapabilityDescriptor[],
 *   actions: Array,
 *   workspaceId: string|null,
 * }>}
 * @param {string} agentId
 * @param {{ agent?: { id: string, actionsEnabled?: boolean, workspaceId?: string|null, webSearchEnabled?: boolean } }} [options]
 *   `agent`: the row this request already loaded (skips a re-read; must be the same agent).
 */
export async function listCapabilitiesForAgent(agentId, { agent: knownAgent = null } = {}) {
  if (!agentId) {
    return { descriptors: [], actions: [], workspaceId: null };
  }
  const agent =
    knownAgent?.id === agentId
      ? knownAgent
      : await prisma.agent.findUnique({
          where: { id: agentId },
          select: { id: true, actionsEnabled: true, workspaceId: true, webSearchEnabled: true },
        });
  if (!agent) {
    return { descriptors: [], actions: [], workspaceId: null };
  }

  const builtins = listBuiltinActionsForAgent(agentId, {
    includeWebSearch: isHostedWebSearchAllowed({
      agentEnabled: agent.webSearchEnabled,
    }),
  });

  if (agent.actionsEnabled === false) {
    return {
      descriptors: builtins.map(toCapabilityDescriptor),
      actions: builtins,
      workspaceId: agent.workspaceId ?? null,
    };
  }

  // One parallel round: actions, their published revisions, MCP tools.
  const [httpActions, publishedRevisions, mcpTools] = await Promise.all([
    prisma.agentAction.findMany({
      where: { agentId, enabled: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actionRevision.findMany({
      where: { state: "PUBLISHED", action: { agentId, enabled: true } },
    }),
    listEnabledMcpToolsForAgent(agentId, { agent }),
  ]);
  const materializedHttpActions = await Promise.all(
    httpActions.map((action) =>
      materializePublishedAction(action, { publishedRevisions })
    )
  );
  const actions = [...builtins, ...materializedHttpActions, ...mcpTools].map((action) => ({
    ...action,
    entities: inferCapabilityEntities(action),
  }));
  return {
    descriptors: actions.map(toCapabilityDescriptor),
    actions,
    workspaceId: agent.workspaceId,
  };
}
