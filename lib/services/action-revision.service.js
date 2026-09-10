import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { getAgentForUser } from "@/lib/services/agent.service";
import { resolveActionConnection } from "@/lib/services/connection.service";
import { validateResponseProjection } from "@/lib/actions/response-projection";
import { extractFrozenHost } from "@/lib/actions/frozen-host";

function httpError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

const SNAPSHOT_FIELDS = [
  "name",
  "description",
  "method",
  "urlTemplate",
  "frozenHost",
  "connectionId",
  "headersJson",
  "requestContentType",
  "requestBodyTemplate",
  "parameterBindings",
  "inputSchemaJson",
  "outputSchemaJson",
  "responseProjectionJson",
  "enabled",
  "timeoutMs",
  "credentialId",
  "riskLevel",
  "requiresConfirmation",
  "requiresIdentity",
  "identityMode",
  "accessClass",
  "idempotent",
];

export function actionSnapshot(action, overrides = {}) {
  const snapshot = {};
  for (const field of SNAPSHOT_FIELDS) {
    const value = overrides[field] !== undefined ? overrides[field] : action[field];
    snapshot[field] = value === undefined ? null : value;
  }
  snapshot.enabled = Boolean(snapshot.enabled);
  snapshot.timeoutMs = Number(snapshot.timeoutMs) || 8000;
  snapshot.idempotent = snapshot.idempotent !== false;
  snapshot.requestContentType = snapshot.requestContentType || "application/json";
  snapshot.frozenHost = extractFrozenHost(snapshot.urlTemplate);
  return snapshot;
}

export function actionConfigurationHash(snapshot) {
  return createHash("sha256")
    .update(JSON.stringify(actionSnapshot(snapshot)))
    .digest("hex");
}

function serializeRevision(revision) {
  if (!revision) return null;
  return {
    id: revision.id,
    actionId: revision.actionId,
    revision: revision.revision,
    state: revision.state,
    configurationHash: revision.configurationHash,
    ...actionSnapshot(revision),
    publishedAt: revision.publishedAt,
    retiredAt: revision.retiredAt,
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
  };
}

async function requireManagedAction(agentId, actionId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  if (!canManageAgentActions({ userId, agent })) {
    throw httpError(403, "Not allowed to manage action revisions");
  }
  const action = await prisma.agentAction.findFirst({ where: { id: actionId, agentId } });
  if (!action) throw httpError(404, "Action not found");
  return { agent, action };
}

function revisionData(actionId, revision, snapshot, state = "DRAFT") {
  return {
    actionId,
    revision,
    state,
    configurationHash: actionConfigurationHash(snapshot),
    ...snapshot,
  };
}

function assertProjection(snapshot) {
  const check = validateResponseProjection(snapshot.responseProjectionJson);
  if (!check.ok) throw httpError(400, check.error, { code: "OUTPUT_PROJECTION_INVALID" });
}

export async function createActionDraftRevision(agentId, actionId, userId, overrides = {}) {
  const { action } = await requireManagedAction(agentId, actionId, userId);
  let base = actionSnapshot(action, overrides);
  if (
    overrides.connectionId !== undefined &&
    overrides.connectionId !== action.connectionId
  ) {
    base.connectionRevisionId = null;
  }
  if (action.publishedRevisionId && Object.keys(overrides).length === 0) {
    const published = await prisma.actionRevision.findUnique({
      where: { id: action.publishedRevisionId },
    });
    if (published) base = actionSnapshot(published);
  }
  if (base.connectionId) {
    const workspaceId = (await getAgentForUser(agentId, userId)).workspaceId;
    const connection = await resolveActionConnection(base, workspaceId);
    base = {
      ...base,
      connectionRevisionId: connection.revision.id,
      credentialId: connection.credentialId || base.credentialId,
    };
  }
  assertProjection(base);
  const latest = await prisma.actionRevision.findFirst({
    where: { actionId },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  const revision = await prisma.$transaction(async (tx) => {
    const row = await tx.actionRevision.create({
      data: revisionData(actionId, (latest?.revision || 0) + 1, base),
    });
    await tx.agentAction.update({
      where: { id: actionId },
      data: { currentDraftRevisionId: row.id },
    });
    return row;
  });
  return serializeRevision(revision);
}

export async function listActionRevisions(agentId, actionId, userId) {
  await requireManagedAction(agentId, actionId, userId);
  const rows = await prisma.actionRevision.findMany({
    where: { actionId },
    orderBy: { revision: "desc" },
  });
  return rows.map(serializeRevision);
}

async function publishRevision(agentId, actionId, revisionId, userId, { allowRetired = false } = {}) {
  const { agent } = await requireManagedAction(agentId, actionId, userId);
  const revision = await prisma.actionRevision.findFirst({
    where: { id: revisionId, actionId },
  });
  if (!revision) throw httpError(404, "Action revision not found");
  if (revision.state === "RETIRED" && !allowRetired) {
    throw httpError(409, "Retired revision cannot be published");
  }
  if (!revision.enabled) throw httpError(400, "Disabled revision cannot be published");
  assertProjection(revision);
  if (revision.connectionId) {
    await resolveActionConnection(revision, agent.workspaceId);
  }
  const hash = actionConfigurationHash(revision);
  if (hash !== revision.configurationHash) {
    throw httpError(409, "Revision configuration hash is stale", { code: "REVISION_HASH_STALE" });
  }
  const published = await prisma.$transaction(async (tx) => {
    await tx.actionRevision.updateMany({
      where: { actionId, state: "PUBLISHED", id: { not: revisionId } },
      data: { state: "RETIRED", retiredAt: new Date() },
    });
    const row = await tx.actionRevision.update({
      where: { id: revisionId },
      data: { state: "PUBLISHED", publishedAt: new Date(), retiredAt: null },
    });
    await tx.agentAction.update({
      where: { id: actionId },
      data: { publishedRevisionId: row.id, currentDraftRevisionId: null },
    });
    return row;
  });
  return serializeRevision(published);
}

export async function publishActionRevision(agentId, actionId, revisionId, userId) {
  return publishRevision(agentId, actionId, revisionId, userId);
}

export async function rollbackActionRevision(agentId, actionId, revisionId, userId) {
  return publishRevision(agentId, actionId, revisionId, userId, { allowRetired: true });
}

export async function materializePublishedAction(action) {
  if (!action?.publishedRevisionId) return action;
  const revision = await prisma.actionRevision.findFirst({
    where: { id: action.publishedRevisionId, actionId: action.id, state: "PUBLISHED" },
  });
  if (!revision) return action;
  return {
    ...action,
    ...actionSnapshot(revision),
    version: revision.revision,
    actionRevisionId: revision.id,
  };
}

export { serializeRevision };
