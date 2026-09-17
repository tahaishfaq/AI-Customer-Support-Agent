/**
 * OpenAPI → disabled AgentAction drafts (no auto-publish, no live invoke).
 */
import {
  canManageAgentActions,
  serializeActionForOwner,
} from "@/lib/actions/action-config";
import { syncAccessClassFields } from "@/lib/actions/access-class";
import { syncIdentityFields } from "@/lib/actions/identity-mode";
import { extractFrozenHost } from "@/lib/actions/frozen-host";
import {
  actionConfigurationHash,
  actionSnapshot,
} from "@/lib/services/action-revision.service";
import { getAgentForUser } from "@/lib/services/agent.service";
import {
  isActionDestinationAllowed,
  resolveActionConnection,
} from "@/lib/services/connection.service";
import { planOpenApiImport } from "@/lib/integrations/openapi/parse-openapi";
import prisma from "@/lib/prisma";

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

function draftCreateData(agentId, draft, { credentialId, connectionId }) {
  const access = syncAccessClassFields({
    ...draft,
    accessClass: draft.accessClass,
    riskLevel: draft.riskLevel,
    requiresConfirmation: draft.requiresConfirmation,
    requiresIdentity: draft.requiresIdentity,
    identityMode: draft.identityMode,
  });
  const identity = syncIdentityFields(access);
  return {
    agentId,
    name: draft.name,
    description: draft.description,
    method: draft.method,
    urlTemplate: draft.urlTemplate,
    frozenHost: extractFrozenHost(draft.urlTemplate),
    connectionId: connectionId || null,
    inputSchemaJson: draft.inputSchemaJson ?? undefined,
    enabled: false,
    timeoutMs: draft.timeoutMs || 8000,
    credentialId: credentialId || null,
    riskLevel: access.riskLevel || "READ",
    requiresConfirmation: Boolean(access.requiresConfirmation),
    requiresIdentity: identity.requiresIdentity,
    identityMode: identity.identityMode,
    accessClass: access.accessClass || "ACCOUNT_READ",
    idempotent: draft.idempotent !== false,
  };
}

/**
 * Preview OpenAPI import without writing.
 */
export async function previewOpenApiActionImport(
  agentId,
  userId,
  { document, baseUrl } = {}
) {
  await requireManagedAgent(agentId, userId);
  const existing = await prisma.agentAction.findMany({
    where: { agentId },
    select: { name: true },
  });
  return planOpenApiImport(document, {
    baseUrl,
    existingNames: existing.map((a) => a.name),
  });
}

/**
 * Create disabled draft AgentActions + DRAFT ActionRevisions.
 * Never publishes. Runtime stays closed until enable + publish/policy review.
 */
export async function importOpenApiActionsForAgent(
  agentId,
  userId,
  {
    document,
    baseUrl,
    credentialId = null,
    connectionId = null,
    dryRun = false,
  } = {}
) {
  const agent = await requireManagedAgent(agentId, userId);

  if (credentialId) {
    const cred = await prisma.actionCredential.findFirst({
      where: {
        id: credentialId,
        workspaceId: agent.workspaceId,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!cred) throw httpError(400, "Credential not found in this workspace");
  }

  const existing = await prisma.agentAction.findMany({
    where: { agentId },
    select: { name: true },
  });
  const plan = planOpenApiImport(document, {
    baseUrl,
    existingNames: existing.map((a) => a.name),
  });

  if (dryRun) {
    return {
      ...plan.meta,
      created: [],
      skipped: plan.skipped,
      drafts: plan.drafts,
      dryRun: true,
    };
  }

  if (connectionId) {
    for (const draft of plan.drafts) {
      const connection = await resolveActionConnection(
        { connectionId, urlTemplate: draft.urlTemplate },
        agent.workspaceId
      );
      if (
        !connection ||
        !isActionDestinationAllowed(draft.urlTemplate, connection.revision)
      ) {
        throw httpError(
          400,
          "Action destination is not allowed by the connection",
          { name: draft.name, urlTemplate: draft.urlTemplate }
        );
      }
    }
  }

  const created = [];
  const skipped = [...plan.skipped];

  for (const draft of plan.drafts) {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const action = await tx.agentAction.create({
          data: draftCreateData(agentId, draft, { credentialId, connectionId }),
        });
        const snapshot = actionSnapshot(action);
        // Keep revision disabled so publish is blocked until policy enable.
        snapshot.enabled = false;
        const revision = await tx.actionRevision.create({
          data: {
            actionId: action.id,
            revision: 1,
            state: "DRAFT",
            configurationHash: actionConfigurationHash(snapshot),
            ...snapshot,
          },
        });
        return tx.agentAction.update({
          where: { id: action.id },
          data: { currentDraftRevisionId: revision.id },
        });
      });
      const serialized = serializeActionForOwner(row);
      created.push({
        ...serialized,
        needsPublish: true,
        needsPolicyReview: true,
        draftRevisionId: row.currentDraftRevisionId,
        openApi: draft.openApi,
      });
    } catch (err) {
      if (err?.code === "P2002") {
        skipped.push({
          path: draft.openApi.path,
          method: draft.openApi.method,
          reason: "NAME_EXISTS",
          name: draft.name,
        });
        continue;
      }
      throw err;
    }
  }

  return {
    ...plan.meta,
    created,
    skipped,
    dryRun: false,
  };
}
