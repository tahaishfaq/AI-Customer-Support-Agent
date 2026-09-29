import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { applyCustomizationPatch } from "@/lib/customization/defaults";
import { normalizeCrawlRecrawlHours } from "@/lib/services/crawl-schedule";
import { resolveAnswerStyle } from "@/lib/services/ai/prompt-builder";
import {
  validateOwnerSiteOriginClaim,
  ensureAgentPublicKey,
} from "@/lib/services/embed.service";
import { createPublicKey } from "@/lib/public-key";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";
import { resolveWorkspaceAccess } from "@/lib/workspace-authz";
import { whiteLabelFieldsInPatch } from "@/lib/customization/white-label";
import { resolveWhiteLabelAccess } from "@/lib/billing/entitlements.service";
import {
  readAllowedOriginsConfig,
} from "@/lib/embed/allowed-origins";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function findMembership(workspaceId, userId) {
  if (!workspaceId || !userId) return null;
  try {
    return await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  } catch {
    return null;
  }
}

/**
 * Resolve seat/owner access for an agent's workspace.
 * Desk handoff stays owner-only elsewhere; this gates agent product APIs.
 */
export async function resolveAgentWorkspaceAccess(agent, userId) {
  if (!agent?.workspaceId || !userId) {
    return { allowed: false, canRead: false, canManage: false, access: null };
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: agent.workspaceId },
  });
  if (!workspace) {
    return { allowed: false, canRead: false, canManage: false, access: null };
  }
  const membership = await findMembership(workspace.id, userId);
  const access = resolveWorkspaceAccess({ workspace, userId, membership });
  return {
    allowed: access.allowed,
    canRead: access.canRead,
    canManage: access.canManage,
    access,
    workspace,
  };
}

export async function listAgentsForUser(userId) {
  const workspace = await resolveActiveWorkspace(userId);
  const membership = await findMembership(workspace.id, userId);
  const access = resolveWorkspaceAccess({ workspace, userId, membership });
  if (!access.canRead) {
    throw httpError(403, "Not allowed to access this workspace");
  }

  const agents = await prisma.agent.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(
    agents.map((agent) =>
      agent.publicKey ? agent : ensureAgentPublicKey(agent)
    )
  );
}

export async function createAgentForUser(userId, data, { role } = {}) {
  const workspace = await resolveActiveWorkspace(userId);
  const membership = await findMembership(workspace.id, userId);
  const access = resolveWorkspaceAccess({ workspace, userId, membership });
  if (!access.canManage) {
    throw httpError(403, "Not allowed to create agents in this workspace");
  }

  const { assertCanCreateAgent, getUserRole } = await import(
    "@/lib/billing/entitlements.service"
  );
  // Billing entitlements stay on the workspace owner.
  const ownerUserId = workspace.userId;
  const userRole = role || (await getUserRole(ownerUserId));
  await assertCanCreateAgent(ownerUserId, workspace.id, userRole);

  const { getPlatformSettings } = await import(
    "@/lib/services/platform-settings.service"
  );
  const settings = await getPlatformSettings();
  if (settings.maxAgentsPerWorkspace > 0) {
    const count = await prisma.agent.count({
      where: { workspaceId: workspace.id },
    });
    if (count >= settings.maxAgentsPerWorkspace) {
      throw httpError(
        400,
        `This workspace can have at most ${settings.maxAgentsPerWorkspace} agents`
      );
    }
  }
  return prisma.agent.create({
    data: {
      userId: ownerUserId,
      workspaceId: workspace.id,
      name: data.name,
      description: data.description ?? null,
      systemPrompt: data.systemPrompt,
      answerStyle: resolveAnswerStyle(data.answerStyle ?? "DETAILED"),
      welcomeMessage: data.welcomeMessage,
      publicKey: createPublicKey(),
      embedEnabled: true,
      actionsEnabled: data.actionsEnabled === true,
      webSearchEnabled: data.webSearchEnabled === true,
    },
  });
}

/**
 * Load an agent for the current user (owner or workspace seat).
 * @param {string} id
 * @param {string} userId
 * @param {{ mutate?: boolean }} [opts] mutate=true requires OWNER/ADMIN
 */
export async function getAgentForUser(id, userId, { mutate = false } = {}) {
  // Independent reads in parallel; every check below still runs on both results.
  const [agent, workspace] = await Promise.all([
    prisma.agent.findUnique({ where: { id } }),
    resolveActiveWorkspace(userId),
  ]);

  if (!agent) {
    throw httpError(404, "Agent not found");
  }

  if (agent.workspaceId !== workspace.id) {
    throw httpError(404, "Agent not found");
  }

  const { canRead, canManage } = await resolveAgentWorkspaceAccess(
    agent,
    userId
  );
  if (!canRead) {
    throw httpError(403, "Not allowed to access this agent");
  }
  if (mutate && !canManage) {
    throw httpError(403, "Not allowed to manage this agent");
  }

  return ensureAgentPublicKey(agent);
}

export async function updateAgentForUser(id, userId, data) {
  const existing = await getAgentForUser(id, userId, { mutate: true });

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt;
  if (data.answerStyle !== undefined) {
    updateData.answerStyle = resolveAnswerStyle(data.answerStyle);
  }
  if (data.welcomeMessage !== undefined) {
    updateData.welcomeMessage = data.welcomeMessage;
  }
  if (data.customization !== undefined) {
    // White-label fields need the agent owner's paid plan (server-enforced).
    const gated = whiteLabelFieldsInPatch(data.customization, existing.customization);
    if (gated.length && !(await resolveWhiteLabelAccess(existing.userId))) {
      const err = httpError(402, "Your plan doesn't include white-labeling. Upgrade to use your own logo, launcher and branding.");
      err.code = "plan_feature_required";
      err.details = { code: "plan_feature_required", fields: gated };
      throw err;
    }
    updateData.customization = applyCustomizationPatch(
      existing.customization,
      data.customization
    );

    // Deploy / Features allowlist base URL: claim siteKnowledgeOrigin when unlocked.
    const { mode, list } = readAllowedOriginsConfig(updateData.customization);
    if (mode === "allowlist" && list.length) {
      const primary = list[0];
      const claim = await validateOwnerSiteOriginClaim(existing, primary);
      if (!claim.ok) {
        if (claim.reason === "agent_locked") {
          const err = httpError(
            409,
            `This agent is locked to ${claim.origin}. Clear website knowledge / site lock before setting a different base URL.`
          );
          err.code = "SITE_ORIGIN_LOCKED";
          err.details = { code: "SITE_ORIGIN_LOCKED", origin: claim.origin };
          throw err;
        }
        if (claim.reason === "origin_taken") {
          const other = claim.takenByAgentName
            ? ` (${claim.takenByAgentName})`
            : "";
          const err = httpError(
            409,
            `This website is already linked to an agent in another workspace${other}.`
          );
          err.code = "CRAWL_ORIGIN_TAKEN";
          err.details = {
            code: "CRAWL_ORIGIN_TAKEN",
            takenByAgentId: claim.takenByAgentId || null,
          };
          throw err;
        }
        const err = httpError(400, "Unable to set website base URL");
        err.code = "SITE_ORIGIN_INVALID";
        throw err;
      }
      if (claim.shouldClaim) {
        updateData.siteKnowledgeOrigin = primary;
      }
    }
  }
  if (data.crawlRecrawlHours !== undefined) {
    updateData.crawlRecrawlHours = normalizeCrawlRecrawlHours(
      data.crawlRecrawlHours
    );
  }
  if (data.actionsEnabled !== undefined) {
    updateData.actionsEnabled = Boolean(data.actionsEnabled);
  }
  if (data.webSearchEnabled !== undefined) {
    updateData.webSearchEnabled = Boolean(data.webSearchEnabled);
  }
  if (data.guidance !== undefined) {
    // Already validated (guidanceSchema); an empty list clears the rules.
    updateData.guidance = data.guidance.length ? data.guidance : Prisma.DbNull;
  }

  return prisma.agent.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteAgentForUser(id, userId) {
  await getAgentForUser(id, userId, { mutate: true });

  await prisma.agent.delete({
    where: { id },
  });
}
