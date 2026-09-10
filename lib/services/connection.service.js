import prisma from "@/lib/prisma";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { getAgentForUser } from "@/lib/services/agent.service";
import { extractFrozenHost } from "@/lib/actions/frozen-host";
import {
  actionOrigin,
  isActionDestinationAllowed,
  normalizeOrigin,
} from "@/lib/actions/connection-policy";

function httpError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function safeDestinations(value, baseOrigin) {
  if (value === undefined || value === null) return [baseOrigin];
  if (!Array.isArray(value) || value.length > 20) {
    throw httpError(400, "allowedDestinations must be an array of at most 20 origins");
  }
  const origins = value.map(normalizeOrigin);
  return [...new Set([baseOrigin, ...origins])];
}

function serializeRevision(revision) {
  if (!revision) return null;
  return {
    id: revision.id,
    revision: revision.revision,
    baseOrigin: revision.baseOrigin,
    allowedDestinations: revision.allowedDestinations || [revision.baseOrigin],
    credentialId: revision.credentialId || null,
    headerPolicy: revision.headerPolicy || null,
    healthVerifiedAt: revision.healthVerifiedAt || null,
    createdAt: revision.createdAt,
  };
}

function serializeConnection(connection) {
  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    name: connection.name,
    environment: connection.environment,
    enabled: Boolean(connection.enabled),
    currentRevisionId: connection.currentRevisionId || null,
    currentRevision: serializeRevision(connection.currentRevision),
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

async function requireManagedAgent(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  if (!canManageAgentActions({ userId, agent })) {
    throw httpError(403, "Not allowed to manage connections for this agent");
  }
  if (!agent.workspaceId) throw httpError(400, "Agent has no workspace");
  return agent;
}

async function assertCredentialInWorkspace(credentialId, workspaceId) {
  if (!credentialId) return;
  const credential = await prisma.actionCredential.findFirst({
    where: { id: credentialId, workspaceId, revokedAt: null },
    select: { id: true },
  });
  if (!credential) throw httpError(400, "Credential not found in this workspace");
}

export async function createConnectionForAgent(agentId, userId, data) {
  const agent = await requireManagedAgent(agentId, userId);
  const name = normalizeName(data.name);
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(name)) {
    throw httpError(400, "Invalid connection name");
  }
  const baseOrigin = normalizeOrigin(data.baseOrigin);
  const allowedDestinations = safeDestinations(data.allowedDestinations, baseOrigin);
  await assertCredentialInWorkspace(data.credentialId, agent.workspaceId);
  try {
    const connection = await prisma.$transaction(async (tx) => {
      const created = await tx.integrationConnection.create({
        data: {
          workspaceId: agent.workspaceId,
          name,
          environment: String(data.environment || "production").trim().toLowerCase(),
          enabled: data.enabled !== false,
        },
      });
      const revision = await tx.integrationConnectionRevision.create({
        data: {
          connectionId: created.id,
          revision: 1,
          baseOrigin,
          allowedDestinations,
          credentialId: data.credentialId || null,
          headerPolicy: data.headerPolicy || null,
        },
      });
      return tx.integrationConnection.update({
        where: { id: created.id },
        data: { currentRevisionId: revision.id },
      });
    });
    return serializeConnection({ ...connection, currentRevision: null });
  } catch (error) {
    if (error?.code === "P2002") throw httpError(409, "A connection with this name already exists");
    throw error;
  }
}

export async function listConnectionsForAgent(agentId, userId) {
  const agent = await requireManagedAgent(agentId, userId);
  const rows = await prisma.integrationConnection.findMany({
    where: { workspaceId: agent.workspaceId },
    orderBy: { createdAt: "asc" },
  });
  const revisions = await prisma.integrationConnectionRevision.findMany({
    where: { id: { in: rows.map((row) => row.currentRevisionId).filter(Boolean) } },
  });
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  return rows.map((row) => serializeConnection({ ...row, currentRevision: byId.get(row.currentRevisionId) || null }));
}

export async function createConnectionRevisionForAgent(agentId, connectionId, userId, data) {
  const agent = await requireManagedAgent(agentId, userId);
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, workspaceId: agent.workspaceId },
  });
  if (!connection) throw httpError(404, "Connection not found");
  const baseOrigin = normalizeOrigin(data.baseOrigin);
  const allowedDestinations = safeDestinations(data.allowedDestinations, baseOrigin);
  await assertCredentialInWorkspace(data.credentialId, agent.workspaceId);
  const revision = await prisma.$transaction(async (tx) => {
    const next = await tx.integrationConnectionRevision.create({
      data: {
        connectionId,
        revision: await tx.integrationConnectionRevision.count({ where: { connectionId } }).then((count) => count + 1),
        baseOrigin,
        allowedDestinations,
        credentialId: data.credentialId || null,
        headerPolicy: data.headerPolicy || null,
      },
    });
    await tx.integrationConnection.update({
      where: { id: connectionId },
      data: { currentRevisionId: next.id },
    });
    return next;
  });
  return serializeRevision(revision);
}

export async function resolveActionConnection(action, workspaceId) {
  if (!action?.connectionId) return null;
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: action.connectionId, workspaceId },
  });
  if (!connection || !connection.enabled || !connection.currentRevisionId) {
    throw httpError(400, "Connection is unavailable", { code: "CONNECTION_UNAVAILABLE" });
  }
  const revision = await prisma.integrationConnectionRevision.findFirst({
    where: {
      id: action.connectionRevisionId || connection.currentRevisionId,
      connectionId: connection.id,
    },
  });
  if (!revision || !isActionDestinationAllowed(action.urlTemplate, revision)) {
    throw httpError(400, "Action destination is not allowed by the connection", {
      code: "CONNECTION_DESTINATION_DENIED",
    });
  }
  return {
    connection,
    revision,
    credentialId: revision.credentialId,
    frozenHost: extractFrozenHost(action.urlTemplate),
  };
}

export {
  actionOrigin,
  isActionDestinationAllowed,
  normalizeOrigin,
  serializeConnection,
  serializeRevision,
};
