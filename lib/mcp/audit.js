/**
 * F13-T4 — structured MCP audit events (no secrets / bodies).
 */
import { safeLogInfo } from "@/lib/observability/safe-log";

/**
 * @param {string} event e.g. mcp.server_create | mcp.tool_enable | mcp.probe
 * @param {{ agentId?: string, mcpServerId?: string, mcpToolId?: string, status?: string, code?: string, durationMs?: number }} meta
 */
export function logMcpAudit(event, meta = {}) {
  const name = String(event || "mcp.event").slice(0, 64);
  safeLogInfo(name, {
    event: name,
    agentId: meta.agentId,
    mcpServerId: meta.mcpServerId,
    mcpToolId: meta.mcpToolId,
    status: meta.status,
    code: meta.code,
    durationMs: meta.durationMs,
    actionName: meta.actionName,
  });
}
