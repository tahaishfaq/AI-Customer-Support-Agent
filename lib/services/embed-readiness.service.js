import prisma from "@/lib/prisma";
import { executeHttpAction } from "@/lib/actions/http-executor";
import {
  canSmokeHttpAction,
  evaluateEmbedReadiness,
  httpUrlNeedsOwnerArgs,
  isDemoIntegrationUrl,
} from "@/lib/embed/readiness";
import { probeMcpServer } from "@/lib/mcp/client";
import { getAgentForUser } from "@/lib/services/agent.service";
import { loadDecryptedCredential } from "@/lib/services/credential.service";

const STALE_MS = 6 * 60 * 60 * 1000;
const PROBE_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_HTTP_PROBES = 6;
const MAX_MCP_PROBES = 4;

function snapshotMap(embedReadiness) {
  const rows = Array.isArray(embedReadiness?.integrations)
    ? embedReadiness.integrations
    : [];
  return new Map(rows.map((row) => [`${row.kind}:${row.id}`, row]));
}

function isStale(checkedAt) {
  if (!checkedAt) return true;
  const t = new Date(checkedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > STALE_MS;
}

function needsAccountIdentity(actions) {
  return actions.some((action) => {
    if (!action.enabled) return false;
    const access = String(action.accessClass || "").toUpperCase();
    return (
      access === "ACCOUNT_READ" ||
      access === "ACCOUNT_WRITE" ||
      action.requiresIdentity === true
    );
  });
}

async function loadSignals(agent) {
  const [embedConversations, identified] = await Promise.all([
    prisma.conversation.count({
      where: { agentId: agent.id, source: "EMBED" },
    }),
    prisma.conversation.count({
      where: {
        agentId: agent.id,
        source: "EMBED",
        customerSubject: { not: null },
      },
    }),
  ]);

  const actions = await prisma.agentAction.findMany({
    where: { agentId: agent.id },
    select: {
      id: true,
      name: true,
      method: true,
      urlTemplate: true,
      enabled: true,
      riskLevel: true,
      accessClass: true,
      requiresIdentity: true,
    },
  });

  return {
    liveOrigin: agent.siteKnowledgeOrigin || null,
    lastPingAt: agent.embedLastPingAt?.toISOString?.() || null,
    setUserSeen: identified > 0,
    embedConversations,
    needsSetUser: needsAccountIdentity(actions),
    actionsEnabled: Boolean(agent.actionsEnabled),
    actions,
  };
}

function mergeInventory(actions, mcpServers, stored) {
  const prev = snapshotMap(stored);
  const rows = [];

  for (const action of actions.filter((a) => a.enabled)) {
    const key = `http:${action.id}`;
    const demo = isDemoIntegrationUrl(action.urlTemplate);
    if (canSmokeHttpAction(action) && httpUrlNeedsOwnerArgs(action.urlTemplate)) {
      rows.push({
        kind: "http",
        id: action.id,
        name: action.name,
        state: "warn",
        reason: "Needs sample args — skipped (no live GET without placeholders).",
        demo,
      });
      continue;
    }
    if (canSmokeHttpAction(action)) {
      const hit = prev.get(key);
      rows.push(
        hit
          ? { ...hit, name: action.name, demo: hit.demo || demo }
          : {
              kind: "http",
              id: action.id,
              name: action.name,
              state: "pending",
              reason: "Not probed yet.",
              demo,
            }
      );
      continue;
    }
    const method = String(action.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      rows.push({
        kind: "http",
        id: action.id,
        name: action.name,
        state: "warn",
        reason: `${method} is not auto-tested.`,
        demo,
      });
    }
  }

  for (const server of mcpServers.filter((s) => s.enabled)) {
    const key = `mcp:${server.id}`;
    const demo = isDemoIntegrationUrl(server.url);
    const hit = prev.get(key);
    rows.push(
      hit
        ? { ...hit, name: server.name, demo: hit.demo || demo }
        : {
            kind: "mcp",
            id: server.id,
            name: server.name,
            state: "pending",
            reason: "Not probed yet.",
            demo,
          }
    );
  }

  return rows;
}

async function smokeHttpAction(agent, action) {
  const demo = isDemoIntegrationUrl(action.urlTemplate);
  let credential = null;
  if (action.credentialId && agent.workspaceId) {
    try {
      credential = await loadDecryptedCredential(
        action.credentialId,
        agent.workspaceId
      );
    } catch (err) {
      return {
        kind: "http",
        id: action.id,
        name: action.name,
        state: "fail",
        reason: err.message || "Credential unavailable",
        demo,
      };
    }
  }

  const allowLocalDemo =
    process.env.NODE_ENV !== "production" ||
    /localhost|127\.0\.0\.1/i.test(action.urlTemplate);

  try {
    const result = await executeHttpAction({
      method: action.method,
      urlTemplate: action.urlTemplate,
      headersJson: action.headersJson,
      requestContentType: action.requestContentType,
      requestBodyTemplate: action.requestBodyTemplate,
      args: {},
      timeoutMs: Math.min(action.timeoutMs || 8000, 8000),
      allowLocalDemo,
      credential,
      frozenHost: action.frozenHost,
      outputSchemaJson: action.outputSchemaJson,
      idempotent: action.idempotent !== false,
      riskLevel: action.riskLevel || "READ",
      retryOnce: false,
    });
    const ok = Boolean(result?.ok);
    const status = result?.httpStatus;
    return {
      kind: "http",
      id: action.id,
      name: action.name,
      state: ok ? (demo ? "warn" : "pass") : "fail",
      reason: ok
        ? demo
          ? `Demo URL responded ${status || 200}`
          : `HTTP ${status || 200}`
        : result?.errorCode || `HTTP ${status || "error"}`,
      demo,
      httpStatus: status || null,
    };
  } catch (err) {
    return {
      kind: "http",
      id: action.id,
      name: action.name,
      state: "fail",
      reason: err.message || "Request failed",
      demo,
    };
  }
}

async function smokeMcpServer(agent, server) {
  const demo = isDemoIntegrationUrl(server.url);
  let secret = null;
  if (server.credentialId && server.authType !== "NONE" && agent.workspaceId) {
    try {
      const cred = await loadDecryptedCredential(
        server.credentialId,
        agent.workspaceId
      );
      secret = cred?.plaintext || null;
    } catch (err) {
      return {
        kind: "mcp",
        id: server.id,
        name: server.name,
        state: "fail",
        reason: err.message || "Credential unavailable",
        demo,
      };
    }
  }

  try {
    const probed = await probeMcpServer({
      url: server.url,
      authType: server.authType,
      headerName: server.headerName,
      secret,
      frozenHost: server.frozenHost,
    });
    const count = Array.isArray(probed.tools) ? probed.tools.length : 0;
    return {
      kind: "mcp",
      id: server.id,
      name: server.name,
      state: demo ? "warn" : "pass",
      reason: demo
        ? `Demo MCP listed ${count} tool${count === 1 ? "" : "s"}`
        : `Listed ${count} tool${count === 1 ? "" : "s"}`,
      demo,
    };
  } catch (err) {
    return {
      kind: "mcp",
      id: server.id,
      name: server.name,
      state: "fail",
      reason: err.message || "MCP probe failed",
      demo,
    };
  }
}

function assemble(agent, signals, integrations, { stale }) {
  const evaluated = evaluateEmbedReadiness({
    liveOrigin: signals.liveOrigin,
    lastPingAt: signals.lastPingAt,
    setUserSeen: signals.setUserSeen,
    embedConversations: signals.embedConversations,
    needsSetUser: signals.needsSetUser,
    actionsEnabled: signals.actionsEnabled,
    integrations,
  });
  return {
    ...evaluated,
    stale: Boolean(stale),
    checkedAt: agent.embedReadiness?.checkedAt || null,
  };
}

export async function getEmbedReadiness(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  const signals = await loadSignals(agent);
  if (agent.actionsEnabled === false) {
    return assemble(agent, signals, [], { stale: false });
  }
  const mcpServers = await prisma.agentMcpServer.findMany({
    where: { agentId: agent.id },
    select: { id: true, name: true, url: true, enabled: true },
  });
  const integrations = mergeInventory(
    signals.actions,
    mcpServers,
    agent.embedReadiness
  );
  const pending = integrations.some((row) => row.state === "pending");
  const stale =
    Boolean(signals.liveOrigin) &&
    (pending || isStale(agent.embedReadiness?.checkedAt));
  return assemble(agent, signals, integrations, { stale });
}

export async function retestEmbedReadiness(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  return runProbesForAgent(agent);
}

export async function maybeRetestAfterLivePing(agentId) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.actionsEnabled === false) return;
  const checkedAt = agent.embedReadiness?.checkedAt;
  if (checkedAt) {
    const t = new Date(checkedAt).getTime();
    if (Number.isFinite(t) && Date.now() - t < PROBE_COOLDOWN_MS) return;
  }
  await runProbesForAgent(agent);
}

async function runProbesForAgent(agent) {
  if (agent.actionsEnabled === false) {
    const signals = await loadSignals(agent);
    return assemble(agent, signals, [], { stale: false });
  }
  const actions = await prisma.agentAction.findMany({
    where: { agentId: agent.id },
  });
  const mcpServers = await prisma.agentMcpServer.findMany({
    where: { agentId: agent.id },
  });

  const integrations = [];
  let httpBudget = 0;
  for (const action of actions.filter((a) => a.enabled)) {
    const demo = isDemoIntegrationUrl(action.urlTemplate);
    if (canSmokeHttpAction(action) && httpUrlNeedsOwnerArgs(action.urlTemplate)) {
      integrations.push({
        kind: "http",
        id: action.id,
        name: action.name,
        state: "warn",
        reason: "Needs sample args — skipped.",
        demo,
      });
      continue;
    }
    if (canSmokeHttpAction(action)) {
      if (httpBudget >= MAX_HTTP_PROBES) {
        integrations.push({
          kind: "http",
          id: action.id,
          name: action.name,
          state: "warn",
          reason: "Skipped (probe cap).",
          demo,
        });
        continue;
      }
      httpBudget += 1;
      integrations.push(await smokeHttpAction(agent, action));
      continue;
    }
    const method = String(action.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      integrations.push({
        kind: "http",
        id: action.id,
        name: action.name,
        state: "warn",
        reason: `${method} is not auto-tested.`,
        demo,
      });
    }
  }

  let mcpBudget = 0;
  for (const server of mcpServers.filter((s) => s.enabled)) {
    if (mcpBudget >= MAX_MCP_PROBES) {
      integrations.push({
        kind: "mcp",
        id: server.id,
        name: server.name,
        state: "warn",
        reason: "Skipped (probe cap).",
        demo: isDemoIntegrationUrl(server.url),
      });
      continue;
    }
    mcpBudget += 1;
    integrations.push(await smokeMcpServer(agent, server));
  }

  const checkedAt = new Date().toISOString();
  await prisma.agent.update({
    where: { id: agent.id },
    data: { embedReadiness: { checkedAt, integrations } },
  });

  const signals = await loadSignals({
    ...agent,
    embedReadiness: { checkedAt, integrations },
  });
  return assemble(
    { ...agent, embedReadiness: { checkedAt, integrations } },
    signals,
    integrations,
    { stale: false }
  );
}
