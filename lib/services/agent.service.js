import prisma from "@/lib/prisma";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function listAgentsForUser(userId) {
  return prisma.agent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAgentForUser(userId, data) {
  return prisma.agent.create({
    data: {
      userId,
      name: data.name,
      description: data.description ?? null,
      systemPrompt: data.systemPrompt,
      welcomeMessage: data.welcomeMessage,
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

  return agent;
}

export async function updateAgentForUser(id, userId, data) {
  await getAgentForUser(id, userId);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt;
  if (data.welcomeMessage !== undefined) {
    updateData.welcomeMessage = data.welcomeMessage;
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
