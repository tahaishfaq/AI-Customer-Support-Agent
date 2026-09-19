/**
 * GitHub MCP OAuth connect — create/link server + store token as ActionCredential.
 * Does not use Dynamic Client Registration (GitHub MCP rejects DCR).
 */

import prisma from "@/lib/prisma";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { encryptSecret } from "@/lib/actions/secrets";
import { extractFrozenHost } from "@/lib/actions/frozen-host";
import { getAgentForUser } from "@/lib/services/agent.service";
import { serializeMcpServer } from "@/lib/services/mcp.service";
import { logMcpAudit } from "@/lib/mcp/audit";
import {
  GITHUB_MCP_DEFAULT_URL,
  buildGithubAuthorizeUrl,
  exchangeGithubOAuthCode,
  getGithubMcpOauthConfig,
  signGithubMcpOauthState,
  verifyGithubMcpOauthState,
} from "@/lib/mcp/github-oauth";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  err.code = details.code;
  return err;
}

async function requireManagedAgent(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  if (!canManageAgentActions({ userId, agent })) {
    throw httpError(403, "Not allowed to manage MCP servers for this agent");
  }
  return agent;
}

export function getGithubMcpOauthStatus() {
  const cfg = getGithubMcpOauthConfig();
  return {
    configured: cfg.configured,
    redirectUri: cfg.redirectUri,
    missing: cfg.missing,
    /**
     * Honest product copy: GitHub remote MCP does not support DCR.
     * Platform must pre-register an OAuth App with this redirect URI.
     */
    note:
      "GitHub MCP does not support dynamic client registration. Register a GitHub OAuth App with this callback URL, then set GITHUB_MCP_OAUTH_CLIENT_ID and GITHUB_MCP_OAUTH_CLIENT_SECRET.",
  };
}

/**
 * Ensure a GitHub MCP server row exists, then return GitHub authorize URL.
 */
export async function startGithubMcpOauthForAgent(agentId, userId, data = {}) {
  const agent = await requireManagedAgent(agentId, userId);
  let workspaceSlug = null;
  if (agent.workspaceId) {
    const ws = await prisma.workspace.findUnique({
      where: { id: agent.workspaceId },
      select: { slug: true },
    });
    workspaceSlug = ws?.slug || null;
  }
  const cfg = getGithubMcpOauthConfig();
  if (!cfg.configured) {
    throw httpError(503, "GitHub MCP OAuth is not configured on this Aide deploy", {
      code: "OAUTH_NOT_CONFIGURED",
      ...getGithubMcpOauthStatus(),
    });
  }

  const url = String(data.url || GITHUB_MCP_DEFAULT_URL).trim() || GITHUB_MCP_DEFAULT_URL;
  const name = String(data.name || "GitHub MCP").trim() || "GitHub MCP";

  let server = null;
  if (data.serverId) {
    server = await prisma.agentMcpServer.findFirst({
      where: { id: data.serverId, agentId },
    });
    if (!server) throw httpError(404, "MCP server not found");
  } else {
    server = await prisma.agentMcpServer.findFirst({
      where: { agentId, url },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!server) {
    try {
      server = await prisma.agentMcpServer.create({
        data: {
          agentId,
          name,
          transport: "HTTP",
          url,
          frozenHost: extractFrozenHost(url),
          authType: "BEARER",
          headerName: null,
          enabled: true,
        },
      });
      logMcpAudit("mcp.server_create", {
        agentId,
        mcpServerId: server.id,
        status: "ok",
        code: "github_oauth_draft",
      });
    } catch (err) {
      if (err?.code === "P2002") {
        server = await prisma.agentMcpServer.findFirst({
          where: { agentId, name },
        });
      } else {
        throw err;
      }
    }
  }

  if (!server) throw httpError(500, "Unable to create GitHub MCP server");

  const state = signGithubMcpOauthState({
    agentId,
    userId,
    serverId: server.id,
    workspaceSlug,
  });
  const authorizeUrl = buildGithubAuthorizeUrl({
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    state,
  });

  logMcpAudit("mcp.github_oauth_start", {
    agentId,
    mcpServerId: server.id,
    status: "ok",
  });

  return {
    authorizeUrl,
    redirectUri: cfg.redirectUri,
    server: serializeMcpServer(server),
  };
}

/**
 * OAuth callback — exchange code, store credential, attach to MCP server.
 * @param {{ code: string, state: string, redirectUri?: string }} opts
 * @returns {Promise<{ redirectPath: string }>}
 */
export async function completeGithubMcpOauth({ code, state, redirectUri }) {
  if (!code) {
    throw httpError(400, "Missing OAuth code", { code: "OAUTH_CODE_MISSING" });
  }
  const payload = verifyGithubMcpOauthState(state);
  const cfg = getGithubMcpOauthConfig();
  if (!cfg.configured) {
    throw httpError(503, "GitHub MCP OAuth is not configured", {
      code: "OAUTH_NOT_CONFIGURED",
    });
  }

  const agent = await requireManagedAgent(payload.agentId, payload.userId);
  const server = await prisma.agentMcpServer.findFirst({
    where: { id: payload.serverId, agentId: payload.agentId },
  });
  if (!server) {
    throw httpError(404, "MCP server not found for OAuth state");
  }

  const token = await exchangeGithubOAuthCode({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    code: String(code),
    redirectUri: redirectUri || cfg.redirectUri,
  });

  const credName = `github_mcp_${String(server.id).slice(-8)}`;
  const ciphertext = encryptSecret(token.access_token);

  let credential = await prisma.actionCredential.findFirst({
    where: {
      workspaceId: agent.workspaceId,
      name: credName,
      revokedAt: null,
    },
  });

  if (credential) {
    credential = await prisma.actionCredential.update({
      where: { id: credential.id },
      data: {
        ciphertext,
        type: "BEARER",
        headerName: null,
        lastRotatedAt: new Date(),
      },
    });
  } else {
    credential = await prisma.actionCredential.create({
      data: {
        workspaceId: agent.workspaceId,
        name: credName,
        type: "BEARER",
        headerName: null,
        ciphertext,
        keyVersion: 1,
      },
    });
  }

  await prisma.agentMcpServer.update({
    where: { id: server.id },
    data: {
      authType: "BEARER",
      credentialId: credential.id,
      lastError: null,
    },
  });

  logMcpAudit("mcp.github_oauth_complete", {
    agentId: payload.agentId,
    mcpServerId: server.id,
    status: "ok",
  });

  const inner = `/agents/${payload.agentId}/customization?tab=actions&mcp=github_oauth_ok&mcpServerId=${server.id}`;
  const slug = payload.workspaceSlug ? String(payload.workspaceSlug).trim() : "";
  const redirectPath = slug ? `/ws/${slug}${inner}` : inner;

  return { redirectPath };
}
