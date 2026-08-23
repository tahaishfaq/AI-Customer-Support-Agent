import prisma from "@/lib/prisma";
import { applyCustomizationPatch } from "@/lib/customization/defaults";
import { normalizeCrawlRecrawlHours } from "@/lib/services/crawl-schedule";
import { resolveAnswerStyle } from "@/lib/services/ai/prompt-builder";
import { ensureAgentPublicKey } from "@/lib/services/embed.service";
import { createPublicKey } from "@/lib/public-key";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function listAgentsForUser(userId) {
  const workspace = await resolveActiveWorkspace(userId);
  const agents = await prisma.agent.findMany({
    where: { userId, workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(
    agents.map((agent) =>
      agent.publicKey ? agent : ensureAgentPublicKey(agent)
    )
  );
}

export async function createAgentForUser(userId, data) {
  const workspace = await resolveActiveWorkspace(userId);
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
      userId,
      workspaceId: workspace.id,
      name: data.name,
      description: data.description ?? null,
      systemPrompt: data.systemPrompt,
      answerStyle: resolveAnswerStyle(data.answerStyle ?? "DETAILED"),
      welcomeMessage: data.welcomeMessage,
      publicKey: createPublicKey(),
      embedEnabled: true,
    },
  });
}

/**
 * Load an agent for the current user.
 * - Not found → 404
 * - Exists but owned by another user → 403
 */
export async function getAgentForUser(id, userId) {
  const agent = await prisma.agent.findUnique({
    where: { id },
  });

  if (!agent) {
    throw httpError(404, "Agent not found");
  }

  if (agent.userId !== userId) {
    throw httpError(403, "Not allowed to access this agent");
  }

  const workspace = await resolveActiveWorkspace(userId);
  if (agent.workspaceId !== workspace.id) {
    throw httpError(404, "Agent not found");
  }

  return ensureAgentPublicKey(agent);
}

export async function updateAgentForUser(id, userId, data) {
  const existing = await getAgentForUser(id, userId);

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
    updateData.customization = applyCustomizationPatch(
      existing.customization,
      data.customization
    );
  }
  if (data.crawlRecrawlHours !== undefined) {
    updateData.crawlRecrawlHours = normalizeCrawlRecrawlHours(
      data.crawlRecrawlHours
    );
  }

  return prisma.agent.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteAgentForUser(id, userId) {
  await getAgentForUser(id, userId);

  await prisma.agent.delete({
    where: { id },
  });
}
