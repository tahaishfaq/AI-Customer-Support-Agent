import prisma from "@/lib/prisma";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { getAgentForUser } from "@/lib/services/agent.service";
import { extractFrozenHost } from "@/lib/actions/frozen-host";
import {
  actionOrigin,
  isActionDestinationAllowed,
  normalizeOrigin,
} from "@/lib/actions/connection-policy";
import { sanitizeConnectionWriteBody } from "@/lib/integrations/connection-wizard";
import {
  buildConnectionProbeUrl,
  connectionVerificationLabel,
  connectionVerificationStatus,
  isProbeHttpSuccess,
} from "@/lib/integrations/connection-probe";
import { executeHttpAction } from "@/lib/actions/http-executor";
import { loadDecryptedCredential } from "@/lib/services/credential.service";

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
  const verificationStatus = connectionVerificationStatus(revision);
  return {
    id: revision.id,
    revision: revision.revision,
    baseOrigin: revision.baseOrigin,
    allowedDestinations: revision.allowedDestinations || [revision.baseOrigin],
    credentialId: revision.credentialId || null,
    headerPolicy: revision.headerPolicy || null,
    healthVerifiedAt: revision.healthVerifiedAt || null,
    verificationStatus,
    verificationLabel: connectionVerificationLabel(verificationStatus),
    liveConnected: verificationStatus === "verified",
    createdAt: revision.createdAt,
  };
}

function serializeConnection(connection) {
  const currentRevision = serializeRevision(connection.currentRevision);
  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    name: connection.name,
    environment: connection.environment,
    enabled: Boolean(connection.enabled),
    currentRevisionId: connection.currentRevisionId || null,
    currentRevision,
    verificationStatus:
      currentRevision?.verificationStatus || "unverified",
    verificationLabel:
      currentRevision?.verificationLabel || "Not verified",
    liveConnected: Boolean(currentRevision?.liveConnected),
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
  const safe = sanitizeConnectionWriteBody(data || {});
  const name = normalizeName(safe.name);
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(name)) {
    throw httpError(400, "Invalid connection name");
  }
  const baseOrigin = normalizeOrigin(safe.baseOrigin);
  const allowedDestinations = safeDestinations(safe.allowedDestinations, baseOrigin);
  await assertCredentialInWorkspace(safe.credentialId, agent.workspaceId);
  try {
    const connection = await prisma.$transaction(async (tx) => {
      const created = await tx.integrationConnection.create({
        data: {
          workspaceId: agent.workspaceId,
          name,
          environment: String(safe.environment || "production").trim().toLowerCase(),
          enabled: safe.enabled !== false,
        },
      });
      const revision = await tx.integrationConnectionRevision.create({
        data: {
          connectionId: created.id,
          revision: 1,
          baseOrigin,
          allowedDestinations,
          credentialId: safe.credentialId || null,
          headerPolicy: safe.headerPolicy || null,
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
  const safe = sanitizeConnectionWriteBody(data || {});
  const baseOrigin = normalizeOrigin(safe.baseOrigin);
  const allowedDestinations = safeDestinations(safe.allowedDestinations, baseOrigin);
  await assertCredentialInWorkspace(safe.credentialId, agent.workspaceId);
  const revision = await prisma.$transaction(async (tx) => {
    const next = await tx.integrationConnectionRevision.create({
      data: {
        connectionId,
        revision: await tx.integrationConnectionRevision.count({ where: { connectionId } }).then((count) => count + 1),
        baseOrigin,
        allowedDestinations,
        credentialId: safe.credentialId || null,
        headerPolicy: safe.headerPolicy || null,
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

export async function resolveActionConnection(
  action,
  workspaceId,
  { allowConnectorRewrite = false } = {}
) {
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
  if (!revision) {
    throw httpError(400, "Connection is unavailable", { code: "CONNECTION_UNAVAILABLE" });
  }

  const destinationOk = isActionDestinationAllowed(action.urlTemplate, revision);
  if (!destinationOk && !allowConnectorRewrite) {
    throw httpError(400, "Action destination is not allowed by the connection", {
      code: "CONNECTION_DESTINATION_DENIED",
    });
  }

  return {
    connection,
    revision,
    credentialId: revision.credentialId,
    frozenHost: destinationOk
      ? extractFrozenHost(action.urlTemplate)
      : extractFrozenHost(revision.baseOrigin),
    connectorRewrite: Boolean(!destinationOk && allowConnectorRewrite),
  };
}

/**
 * Owner probe: GET connection base origin through http-executor + optional credential.
 * Sets healthVerifiedAt only on success. Never returns response bodies or secrets.
 */
export async function probeConnectionForAgent(
  agentId,
  connectionId,
  userId,
  { path = "/" } = {}
) {
  const agent = await requireManagedAgent(agentId, userId);
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, workspaceId: agent.workspaceId },
  });
  if (!connection || !connection.currentRevisionId) {
    throw httpError(404, "Connection not found");
  }
  const revision = await prisma.integrationConnectionRevision.findFirst({
    where: { id: connection.currentRevisionId, connectionId: connection.id },
  });
  if (!revision) throw httpError(404, "Connection revision not found");

  const urlTemplate = buildConnectionProbeUrl(revision.baseOrigin, path);
  let credential = null;
  if (revision.credentialId) {
    credential = await loadDecryptedCredential(
      revision.credentialId,
      agent.workspaceId
    );
  }

  const result = await executeHttpAction({
    method: "GET",
    urlTemplate,
    args: {},
    timeoutMs: 8000,
    allowLocalDemo: true,
    retryOnce: false,
    credential,
    frozenHost: extractFrozenHost(urlTemplate),
    riskLevel: "READ",
    idempotent: true,
  });

  const httpStatus = result?.httpStatus ?? null;
  const transportOk =
    result?.errorCode !== "SSRF_BLOCKED" &&
    result?.errorCode !== "FROZEN_HOST_MISMATCH" &&
    result?.errorCode !== "CREDENTIAL_MISSING";
  const ok = transportOk && isProbeHttpSuccess(httpStatus);
  if (ok) {
    await prisma.integrationConnectionRevision.update({
      where: { id: revision.id },
      data: { healthVerifiedAt: new Date() },
    });
  } else {
    await prisma.integrationConnectionRevision.update({
      where: { id: revision.id },
      data: { healthVerifiedAt: null },
    });
  }

  return {
    ok,
    liveConnected: ok,
    verificationStatus: ok ? "verified" : "unverified",
    verificationLabel: ok ? "Verified" : "Not verified",
    httpStatus,
    errorCode: ok
      ? null
      : result?.errorCode ||
        (httpStatus && httpStatus >= 500 ? "UPSTREAM_5XX" : "PROBE_FAILED"),
    connectionId: connection.id,
    // Never echo bodyText / headers / credential material.
  };
}

export {
  actionOrigin,
  isActionDestinationAllowed,
  normalizeOrigin,
  serializeConnection,
  serializeRevision,
};
