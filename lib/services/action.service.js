import prisma from "@/lib/prisma";
import {
  canManageAgentActions,
  mergeHeadersPreservingSecrets,
  serializeActionForOwner,
} from "@/lib/actions/action-config";
import { syncIdentityFields } from "@/lib/actions/identity-mode";
import { syncAccessClassFields } from "@/lib/actions/access-class";
import { extractFrozenHost } from "@/lib/actions/frozen-host";
import { executeHttpAction } from "@/lib/actions/http-executor";
import { loadDecryptedCredential } from "@/lib/services/credential.service";
import { rateLimit } from "@/lib/rate-limit";
import { actionOutboundLimitOpts, actionWorkspaceDailyLimitOpts } from "@/lib/rate-limit-config";
import { getAgentForUser } from "@/lib/services/agent.service";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

async function requireManagedAgent(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  if (!canManageAgentActions({ userId, agent })) {
    throw httpError(403, "Not allowed to manage actions for this agent");
  }
  return agent;
}

function actionCreateData(agentId, data) {
  const urlTemplate = data.urlTemplate;
  const access = syncAccessClassFields(data);
  const identity = syncIdentityFields(access);
  return {
    agentId,
    name: data.name,
    description: data.description,
    method: data.method,
    urlTemplate,
    frozenHost: extractFrozenHost(urlTemplate),
    headersJson: data.headersJson ?? undefined,
    inputSchemaJson: data.inputSchemaJson ?? undefined,
    outputSchemaJson: data.outputSchemaJson ?? undefined,
    enabled: data.enabled ?? true,
    timeoutMs: data.timeoutMs,
    credentialId: data.credentialId ?? null,
    riskLevel: access.riskLevel || data.riskLevel || "READ",
    requiresConfirmation: Boolean(access.requiresConfirmation),
    requiresIdentity: identity.requiresIdentity,
    identityMode: identity.identityMode,
    accessClass: access.accessClass || "PUBLIC_READ",
    idempotent: data.idempotent !== false,
  };
}

export async function listActionsForAgent(agentId, userId) {
  await requireManagedAgent(agentId, userId);
  const actions = await prisma.agentAction.findMany({
    where: { agentId },
    orderBy: { createdAt: "asc" },
  });
  return actions.map(serializeActionForOwner);
}

export async function createActionForAgent(agentId, userId, data) {
  const agent = await requireManagedAgent(agentId, userId);
  if (data.credentialId) {
    await assertCredentialInWorkspace(data.credentialId, agent.workspaceId);
  }
  try {
    const action = await prisma.agentAction.create({
      data: actionCreateData(agentId, data),
    });
    return serializeActionForOwner(action);
  } catch (err) {
    if (err?.code === "P2002") {
      throw httpError(409, "An action with this name already exists");
    }
    throw err;
  }
}

export async function updateActionForAgent(agentId, actionId, userId, data) {
  const agent = await requireManagedAgent(agentId, userId);
  const existing = await prisma.agentAction.findFirst({
    where: { id: actionId, agentId },
  });
  if (!existing) throw httpError(404, "Action not found");

  if (data.credentialId) {
    await assertCredentialInWorkspace(data.credentialId, agent.workspaceId);
  }

  const headersJson =
    data.headersJson !== undefined
      ? mergeHeadersPreservingSecrets(data.headersJson, existing.headersJson)
      : undefined;

  const urlTemplate =
    data.urlTemplate !== undefined ? data.urlTemplate : undefined;
  const bumpVersion =
    urlTemplate !== undefined ||
    data.method !== undefined ||
    data.credentialId !== undefined ||
    data.riskLevel !== undefined;

  try {
    const action = await prisma.agentAction.update({
      where: { id: actionId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.method !== undefined ? { method: data.method } : {}),
        ...(urlTemplate !== undefined
          ? {
              urlTemplate,
              frozenHost: extractFrozenHost(urlTemplate),
            }
          : {}),
        ...(headersJson !== undefined ? { headersJson } : {}),
        ...(data.inputSchemaJson !== undefined
          ? { inputSchemaJson: data.inputSchemaJson }
          : {}),
        ...(data.outputSchemaJson !== undefined
          ? { outputSchemaJson: data.outputSchemaJson }
          : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.timeoutMs !== undefined ? { timeoutMs: data.timeoutMs } : {}),
        ...(data.credentialId !== undefined
          ? { credentialId: data.credentialId }
          : {}),
        ...(data.identityMode !== undefined ||
        data.requiresIdentity !== undefined ||
        data.accessClass !== undefined ||
        data.riskLevel !== undefined
          ? (() => {
              const access = syncAccessClassFields({
                ...existing,
                ...data,
              });
              const synced = syncIdentityFields(access);
              return {
                accessClass: access.accessClass,
                riskLevel: access.riskLevel,
                requiresConfirmation: access.requiresConfirmation,
                identityMode: synced.identityMode,
                requiresIdentity: synced.requiresIdentity,
              };
            })()
          : {}),
        ...(data.requiresConfirmation !== undefined &&
        data.accessClass === undefined &&
        data.identityMode === undefined &&
        data.riskLevel === undefined
          ? { requiresConfirmation: data.requiresConfirmation }
          : {}),
        ...(data.idempotent !== undefined ? { idempotent: data.idempotent } : {}),
        ...(bumpVersion ? { version: { increment: 1 } } : {}),
      },
    });
    return serializeActionForOwner(action);
  } catch (err) {
    if (err?.code === "P2002") {
      throw httpError(409, "An action with this name already exists");
    }
    throw err;
  }
}

async function assertCredentialInWorkspace(credentialId, workspaceId) {
  if (!credentialId) return;
  const cred = await prisma.actionCredential.findFirst({
    where: { id: credentialId, workspaceId, revokedAt: null },
    select: { id: true },
  });
  if (!cred) {
    throw httpError(400, "Credential not found in this workspace");
  }
}

export async function deleteActionForAgent(agentId, actionId, userId) {
  await requireManagedAgent(agentId, userId);
  const existing = await prisma.agentAction.findFirst({
    where: { id: actionId, agentId },
    select: { id: true },
  });
  if (!existing) throw httpError(404, "Action not found");
  await prisma.agentAction.delete({ where: { id: actionId } });
  return { ok: true };
}

export async function testActionForAgent(agentId, actionId, userId, { args = {} } = {}) {
  const agent = await requireManagedAgent(agentId, userId);
  if (agent.actionsEnabled === false) {
    throw httpError(400, "Actions are disabled for this agent");
  }
  const action = await prisma.agentAction.findFirst({
    where: { id: actionId, agentId },
  });
  if (!action) throw httpError(404, "Action not found");
  if (!action.enabled) {
    throw httpError(400, "Action is disabled");
  }

  const limited = rateLimit(`actions:outbound:${agentId}`, actionOutboundLimitOpts());
  if (!limited.ok) {
    throw httpError(429, "Too many action calls. Try again shortly.", {
      retryAfterSec: limited.retryAfterSec,
    });
  }

  if (agent.workspaceId) {
    const daily = rateLimit(
      `actions:daily:${agent.workspaceId}`,
      actionWorkspaceDailyLimitOpts()
    );
    if (!daily.ok) {
      throw httpError(429, "Workspace daily action limit reached. Try again tomorrow.", {
        retryAfterSec: daily.retryAfterSec,
      });
    }
  }

  const allowLocalDemo =
    process.env.NODE_ENV !== "production" ||
    /localhost|127\.0\.0\.1/i.test(action.urlTemplate);

  const { withOutboundSlot } = await import("@/lib/actions/outbound-semaphore");
  const {
    getCachedGetResult,
    isGetMethod,
    setCachedGetResult,
  } = await import("@/lib/actions/get-cache");

  if (isGetMethod(action.method)) {
    const cached = getCachedGetResult(action.id, args);
    if (cached) {
      await prisma.toolRun.create({
        data: {
          agentId,
          actionId: action.id,
          workspaceId: agent.workspaceId,
          actionVersion: action.version,
          status: cached.status,
          durationMs: 0,
          httpStatus: cached.httpStatus,
          errorCode: "CACHE_HIT",
          errorCategory: "cache",
        },
      });
      return {
        action: serializeActionForOwner(action),
        result: {
          ok: cached.ok,
          status: cached.status,
          httpStatus: cached.httpStatus,
          durationMs: 0,
          errorCode: "CACHE_HIT",
          bodyText: cached.bodyText,
          truncated: cached.truncated,
          demo: Boolean(cached.demo),
          cached: true,
        },
      };
    }
  }

  let credential = null;
  if (action.credentialId && agent.workspaceId) {
    try {
      credential = await loadDecryptedCredential(
        action.credentialId,
        agent.workspaceId
      );
    } catch (err) {
      throw httpError(400, err.message || "Credential unavailable", {
        code: err?.details?.code || err?.code || "CREDENTIAL_REVOKED",
      });
    }
  }

  const result = await withOutboundSlot(agentId, () =>
    executeHttpAction({
      method: action.method,
      urlTemplate: action.urlTemplate,
      headersJson: action.headersJson,
      args,
      timeoutMs: action.timeoutMs,
      allowLocalDemo,
      credential,
      frozenHost: action.frozenHost,
      outputSchemaJson: action.outputSchemaJson,
      idempotent: action.idempotent !== false,
      riskLevel: action.riskLevel || "READ",
    })
  );

  if (result?.errorCode === "CONCURRENCY_LIMIT") {
    throw httpError(429, "Too many concurrent action calls. Try again shortly.");
  }

  if (isGetMethod(action.method) && result?.ok) {
    setCachedGetResult(action.id, args, result);
  }

  await prisma.toolRun.create({
    data: {
      agentId,
      actionId: action.id,
      workspaceId: agent.workspaceId,
      actionVersion: action.version,
      status: result.status,
      durationMs: result.durationMs,
      httpStatus: result.httpStatus,
      errorCode: result.errorCode,
      errorCategory: result.ok ? null : "http",
    },
  });

  return {
    action: serializeActionForOwner(action),
    result: {
      ok: result.ok,
      status: result.status,
      httpStatus: result.httpStatus,
      durationMs: result.durationMs,
      errorCode: result.errorCode,
      bodyText: result.bodyText,
      truncated: result.truncated,
      demo: Boolean(result.demo),
    },
  };
}

/**
 * Recent ToolRun rows for owner audit (no response bodies / secrets).
 */
export async function listToolRunsForAgent(agentId, userId, { take = 30 } = {}) {
  await requireManagedAgent(agentId, userId);
  const limit = Math.min(Math.max(Number(take) || 30, 1), 100);
  const runs = await prisma.toolRun.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      actionId: true,
      conversationId: true,
      workspaceId: true,
      customerSubject: true,
      actionVersion: true,
      status: true,
      durationMs: true,
      httpStatus: true,
      errorCode: true,
      errorCategory: true,
      requestId: true,
      createdAt: true,
      action: { select: { name: true } },
    },
  });
  return runs.map((run) => ({
    id: run.id,
    actionId: run.actionId,
    actionName: run.action?.name || null,
    conversationId: run.conversationId,
    workspaceId: run.workspaceId,
    customerSubject: run.customerSubject,
    actionVersion: run.actionVersion,
    status: run.status,
    durationMs: run.durationMs,
    httpStatus: run.httpStatus,
    errorCode: run.errorCode,
    errorCategory: run.errorCategory,
    requestId: run.requestId,
    createdAt: run.createdAt,
  }));
}
