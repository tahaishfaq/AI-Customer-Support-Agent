/**
 * F13-T3 — Owner MCP server CRUD + probe/sync tools.
 */
import prisma from "@/lib/prisma";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { extractFrozenHost } from "@/lib/actions/frozen-host";
import {
  callMcpTool,
  formatMcpToolResultForModel,
  inferMcpToolRisk,
  probeMcpServer,
  sanitizeMcpFunctionName,
} from "@/lib/mcp/client";
import { logMcpAudit } from "@/lib/mcp/audit";
import { loadDecryptedCredential } from "@/lib/services/credential.service";
import { getAgentForUser } from "@/lib/services/agent.service";
import { rateLimit } from "@/lib/rate-limit";
import { mcpServerOutboundLimitOpts } from "@/lib/rate-limit-config";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

async function requireManagedAgent(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  if (!canManageAgentActions({ userId, agent })) {
    throw httpError(403, "Not allowed to manage MCP servers for this agent");
  }
  return agent;
}

async function assertCredentialInWorkspace(credentialId, workspaceId) {
  if (!credentialId) return;
  const cred = await prisma.actionCredential.findFirst({
    where: { id: credentialId, workspaceId, revokedAt: null },
    select: { id: true },
  });
  if (!cred) throw httpError(400, "Credential not found in this workspace");
}

export function serializeMcpServer(server) {
  if (!server) return null;
  return {
    id: server.id,
    agentId: server.agentId,
    name: server.name,
    transport: server.transport,
    url: server.url,
    frozenHost: server.frozenHost,
    authType: server.authType,
    headerName: server.headerName,
    credentialId: server.credentialId,
    enabled: server.enabled,
    lastProbeAt: server.lastProbeAt,
    lastError: server.lastError,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    tools: Array.isArray(server.tools)
      ? server.tools.map(serializeMcpTool)
      : undefined,
  };
}

export function serializeMcpTool(tool) {
  if (!tool) return null;
  return {
    id: tool.id,
    serverId: tool.serverId,
    name: tool.name,
    functionName: tool.functionName,
    description: tool.description,
    inputSchemaJson: tool.inputSchemaJson ?? null,
    enabled: tool.enabled,
    riskLevel: tool.riskLevel,
    requiresConfirmation: tool.requiresConfirmation,
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt,
  };
}

export async function listMcpServersForAgent(agentId, userId) {
  await requireManagedAgent(agentId, userId);
  const servers = await prisma.agentMcpServer.findMany({
    where: { agentId },
    include: { tools: { orderBy: { name: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return servers.map(serializeMcpServer);
}

export async function createMcpServerForAgent(agentId, userId, data) {
  const agent = await requireManagedAgent(agentId, userId);
  if (data.credentialId) {
    await assertCredentialInWorkspace(data.credentialId, agent.workspaceId);
  }
  const url = String(data.url || "").trim();
  try {
    const server = await prisma.agentMcpServer.create({
      data: {
        agentId,
        name: String(data.name || "").trim(),
        transport: data.transport === "SSE" ? "SSE" : "HTTP",
        url,
        frozenHost: extractFrozenHost(url),
        authType: data.authType || "NONE",
        headerName: data.headerName || null,
        credentialId: data.credentialId || null,
        enabled: data.enabled !== false,
      },
      include: { tools: true },
    });
    logMcpAudit("mcp.server_create", {
      agentId,
      mcpServerId: server.id,
      status: "ok",
    });
    return serializeMcpServer(server);
  } catch (err) {
    if (err?.code === "P2002") {
      throw httpError(409, "An MCP server with this name already exists");
    }
    throw err;
  }
}

export async function getMcpServerForAgent(agentId, serverId, userId) {
  await requireManagedAgent(agentId, userId);
  const server = await prisma.agentMcpServer.findFirst({
    where: { id: serverId, agentId },
    include: { tools: { orderBy: { name: "asc" } } },
  });
  if (!server) throw httpError(404, "MCP server not found");
  return serializeMcpServer(server);
}

export async function updateMcpServerForAgent(agentId, serverId, userId, data) {
  const agent = await requireManagedAgent(agentId, userId);
  const existing = await prisma.agentMcpServer.findFirst({
    where: { id: serverId, agentId },
  });
  if (!existing) throw httpError(404, "MCP server not found");

  if (data.credentialId !== undefined && data.credentialId) {
    await assertCredentialInWorkspace(data.credentialId, agent.workspaceId);
  }

  const nextUrl =
    data.url !== undefined ? String(data.url || "").trim() : existing.url;

  try {
    const server = await prisma.agentMcpServer.update({
      where: { id: serverId },
      data: {
        ...(data.name !== undefined
          ? { name: String(data.name || "").trim() }
          : {}),
        ...(data.transport !== undefined
          ? { transport: data.transport === "SSE" ? "SSE" : "HTTP" }
          : {}),
        ...(data.url !== undefined
          ? { url: nextUrl, frozenHost: extractFrozenHost(nextUrl) }
          : {}),
        ...(data.authType !== undefined ? { authType: data.authType } : {}),
        ...(data.headerName !== undefined
          ? { headerName: data.headerName || null }
          : {}),
        ...(data.credentialId !== undefined
          ? { credentialId: data.credentialId || null }
          : {}),
        ...(data.enabled !== undefined ? { enabled: Boolean(data.enabled) } : {}),
      },
      include: { tools: { orderBy: { name: "asc" } } },
    });
    if (data.enabled !== undefined) {
      logMcpAudit("mcp.server_enable", {
        agentId,
        mcpServerId: serverId,
        status: server.enabled ? "on" : "off",
      });
    } else {
      logMcpAudit("mcp.server_update", {
        agentId,
        mcpServerId: serverId,
        status: "ok",
      });
    }
    return serializeMcpServer(server);
  } catch (err) {
    if (err?.code === "P2002") {
      throw httpError(409, "An MCP server with this name already exists");
    }
    throw err;
  }
}

export async function deleteMcpServerForAgent(agentId, serverId, userId) {
  await requireManagedAgent(agentId, userId);
  const existing = await prisma.agentMcpServer.findFirst({
    where: { id: serverId, agentId },
    select: { id: true },
  });
  if (!existing) throw httpError(404, "MCP server not found");
  await prisma.agentMcpServer.delete({ where: { id: serverId } });
  logMcpAudit("mcp.server_delete", {
    agentId,
    mcpServerId: serverId,
    status: "ok",
  });
  return { ok: true };
}

export async function updateMcpToolForAgent(
  agentId,
  serverId,
  toolId,
  userId,
  data
) {
  await requireManagedAgent(agentId, userId);
  const tool = await prisma.agentMcpTool.findFirst({
    where: { id: toolId, serverId, server: { agentId } },
  });
  if (!tool) throw httpError(404, "MCP tool not found");

  const updated = await prisma.agentMcpTool.update({
    where: { id: toolId },
    data: {
      ...(data.enabled !== undefined ? { enabled: Boolean(data.enabled) } : {}),
      ...(data.riskLevel !== undefined ? { riskLevel: data.riskLevel } : {}),
      ...(data.requiresConfirmation !== undefined
        ? { requiresConfirmation: Boolean(data.requiresConfirmation) }
        : {}),
    },
  });
  if (data.enabled !== undefined) {
    logMcpAudit("mcp.tool_enable", {
      agentId,
      mcpServerId: serverId,
      mcpToolId: toolId,
      actionName: updated.functionName,
      status: updated.enabled ? "on" : "off",
    });
  }
  return serializeMcpTool(updated);
}

async function loadServerSecret(server, workspaceId) {
  if (!server.credentialId || server.authType === "NONE") {
    return null;
  }
  const cred = await loadDecryptedCredential(server.credentialId, workspaceId);
  return cred?.plaintext || null;
}

/**
 * Probe remote MCP, upsert discovered tools (keep enable flags for known names).
 */
export async function probeMcpServerForAgent(agentId, serverId, userId) {
  const agent = await requireManagedAgent(agentId, userId);
  const server = await prisma.agentMcpServer.findFirst({
    where: { id: serverId, agentId },
    include: { tools: true },
  });
  if (!server) throw httpError(404, "MCP server not found");

  try {
    const secret = await loadServerSecret(server, agent.workspaceId);
    const probed = await probeMcpServer({
      url: server.url,
      authType: server.authType,
      headerName: server.headerName,
      secret,
      frozenHost: server.frozenHost,
    });

    const existingByName = new Map(server.tools.map((t) => [t.name, t]));
    const seen = new Set();
    const slug = server.name;

    for (const discovered of probed.tools) {
      seen.add(discovered.name);
      const risk = inferMcpToolRisk(discovered.name);
      const prev = existingByName.get(discovered.name);
      const functionName =
        prev?.functionName ||
        sanitizeMcpFunctionName(slug, discovered.name);

      if (prev) {
        await prisma.agentMcpTool.update({
          where: { id: prev.id },
          data: {
            description: discovered.description || prev.description,
            inputSchemaJson: discovered.inputSchemaJson,
            // keep enabled / risk overrides if owner already set; only seed risk on first see
          },
        });
      } else {
        await prisma.agentMcpTool.create({
          data: {
            serverId: server.id,
            name: discovered.name,
            functionName,
            description: discovered.description || "",
            inputSchemaJson: discovered.inputSchemaJson,
            enabled: false,
            riskLevel: risk.riskLevel,
            requiresConfirmation: risk.requiresConfirmation,
          },
        });
      }
    }

    // Drop tools that disappeared from remote
    for (const prev of server.tools) {
      if (!seen.has(prev.name)) {
        await prisma.agentMcpTool.delete({ where: { id: prev.id } });
      }
    }

    const updated = await prisma.agentMcpServer.update({
      where: { id: server.id },
      data: {
        lastProbeAt: new Date(),
        lastError: null,
        frozenHost: probed.frozenHost || server.frozenHost,
      },
      include: { tools: { orderBy: { name: "asc" } } },
    });

    logMcpAudit("mcp.probe", {
      agentId,
      mcpServerId: server.id,
      status: "ok",
      code: String(probed.tools.length),
    });

    return {
      server: serializeMcpServer(updated),
      discovered: probed.tools.length,
      serverInfo: probed.serverInfo,
    };
  } catch (err) {
    const message = err.message || "MCP probe failed";
    await prisma.agentMcpServer.update({
      where: { id: server.id },
      data: {
        lastProbeAt: new Date(),
        lastError: message.slice(0, 500),
      },
    });
    logMcpAudit("mcp.probe", {
      agentId,
      mcpServerId: server.id,
      status: "error",
      code: err.code || "MCP_PROBE",
    });
    throw httpError(err.status || 502, message, { code: err.code || "MCP_PROBE" });
  }
}

/**
 * Runtime: enabled MCP tools for chat (respects actionsEnabled kill switch).
 */
export async function listEnabledMcpToolsForAgent(agentId) {
  if (!agentId) return [];
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { actionsEnabled: true, workspaceId: true },
  });
  if (!agent || agent.actionsEnabled === false) return [];

  const tools = await prisma.agentMcpTool.findMany({
    where: {
      enabled: true,
      server: { agentId, enabled: true },
    },
    include: {
      server: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return tools.map((tool) => mcpToolToActionShape(tool, agent.workspaceId));
}

export function mcpToolToActionShape(tool, workspaceId = null) {
  const server = tool.server;
  return {
    id: tool.id,
    agentId: server.agentId,
    name: tool.functionName,
    description: tool.description || `MCP tool ${tool.name}`,
    method: "POST",
    urlTemplate: server.url,
    inputSchemaJson: tool.inputSchemaJson,
    enabled: tool.enabled && server.enabled,
    timeoutMs: 12000,
    credentialId: server.credentialId,
    riskLevel: tool.riskLevel,
    requiresConfirmation: tool.requiresConfirmation,
    requiresIdentity: false,
    idempotent: tool.riskLevel === "READ",
    version: 1,
    workspaceId,
    _mcp: {
      toolId: tool.id,
      serverId: server.id,
      remoteName: tool.name,
      url: server.url,
      frozenHost: server.frozenHost,
      authType: server.authType,
      headerName: server.headerName,
      credentialId: server.credentialId,
      transport: server.transport,
    },
  };
}

export async function executeMcpToolAction({
  action,
  args = {},
  workspaceId,
  signal,
}) {
  const meta = action?._mcp;
  if (!meta) throw httpError(400, "Not an MCP tool");

  const serverLimited = rateLimit(
    `mcp:outbound:${meta.serverId}`,
    mcpServerOutboundLimitOpts()
  );
  if (!serverLimited.ok) {
    return {
      ok: false,
      status: "ERROR",
      httpStatus: null,
      durationMs: 0,
      bodyText: "Too many MCP calls for this server. Try again shortly.",
      errorCode: "MCP_SERVER_RATE_LIMITED",
    };
  }

  let secret = null;
  if (meta.credentialId && meta.authType !== "NONE") {
    const cred = await loadDecryptedCredential(meta.credentialId, workspaceId);
    secret = cred?.plaintext || null;
  }

  const started = Date.now();
  try {
    const result = await callMcpTool({
      url: meta.url,
      authType: meta.authType,
      headerName: meta.headerName,
      secret,
      frozenHost: meta.frozenHost,
      toolName: meta.remoteName,
      args,
      signal,
    });
    const bodyText = formatMcpToolResultForModel(result);
    const isError = Boolean(result?.isError);
    logMcpAudit("mcp.tool_call", {
      agentId: action.agentId,
      mcpServerId: meta.serverId,
      mcpToolId: meta.toolId,
      actionName: action.name,
      status: isError ? "error" : "ok",
      durationMs: Date.now() - started,
      code: isError ? "MCP_TOOL_ERROR" : undefined,
    });
    return {
      ok: !isError,
      status: isError ? "ERROR" : "OK",
      httpStatus: 200,
      durationMs: Date.now() - started,
      bodyText,
      errorCode: isError ? "MCP_TOOL_ERROR" : null,
    };
  } catch (err) {
    logMcpAudit("mcp.tool_call", {
      agentId: action.agentId,
      mcpServerId: meta.serverId,
      mcpToolId: meta.toolId,
      actionName: action.name,
      status: "error",
      durationMs: Date.now() - started,
      code: err.code || "MCP_ERROR",
    });
    return {
      ok: false,
      status: err.code === "TIMEOUT" ? "TIMEOUT" : err.code === "SSRF_BLOCKED" ? "SSRF_BLOCKED" : "ERROR",
      httpStatus: err.status || null,
      durationMs: Date.now() - started,
      bodyText: err.message || "MCP call failed",
      errorCode: err.code || "MCP_ERROR",
    };
  }
}
