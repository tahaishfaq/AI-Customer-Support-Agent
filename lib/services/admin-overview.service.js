import prisma from "@/lib/prisma";

export async function getPlatformOverview() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    users,
    workspaces,
    agents,
    conversationsTotal,
    conversations24h,
    pendingRestoreCount,
    suspendedUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.agent.count(),
    prisma.conversation.count(),
    prisma.conversation.count({
      where: { startedAt: { gte: since } },
    }),
    prisma.restoreRequest.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
  ]);

  return {
    users,
    workspaces,
    agents,
    conversationsTotal,
    conversations24h,
    pendingRestoreCount,
    suspendedUsers,
  };
}
