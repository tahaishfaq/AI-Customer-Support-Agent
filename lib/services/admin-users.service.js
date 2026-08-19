import prisma from "@/lib/prisma";
import { getLatestRestoreRequest, approvePendingRestoreRequestsForUser } from "@/lib/services/restore-request.service";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function toUserRow(user, extras = {}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    workspaceCount: user._count?.workspaces ?? extras.workspaceCount ?? 0,
    agentCount: user._count?.agents ?? extras.agentCount ?? 0,
  };
}

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

export async function listAdminUsers({
  q = "",
  status = "",
  role = "",
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
} = {}) {
  const query = String(q || "").trim();
  const where = {};
  if (status === "ACTIVE" || status === "SUSPENDED") {
    where.status = status;
  }
  if (role === "USER" || role === "ADMIN") {
    where.role = role;
  }
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  const size = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number.parseInt(pageSize, 10) || PAGE_SIZE_DEFAULT)
  );
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const skip = (currentPage - 1) * size;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { workspaces: true, agents: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    users: users.map((user) => toUserRow(user)),
    page: currentPage,
    pageSize: size,
    total,
    totalPages,
  };
}

export async function getAdminUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { workspaces: true, agents: true } },
    },
  });
  if (!user) {
    throw httpError(404, "User not found");
  }

  const workspaces = await listWorkspacesForUser(id);
  const restoreRequest = await getLatestRestoreRequest(id);
  return { ...toUserRow(user), workspaces, restoreRequest };
}

export async function listWorkspacesForUser(userId) {
  const workspaces = await prisma.workspace.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { agents: true } } },
  });
  if (!workspaces.length) return [];

  const ids = workspaces.map((w) => w.id);
  const recent = await prisma.conversation.findMany({
    where: { agent: { workspaceId: { in: ids } } },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      startedAt: true,
      agent: { select: { workspaceId: true } },
    },
  });

  const lastByWorkspace = {};
  for (const row of recent) {
    const workspaceId = row.agent.workspaceId;
    if (!lastByWorkspace[workspaceId]) {
      lastByWorkspace[workspaceId] = row.startedAt;
    }
  }

  return workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    agentCount: workspace._count.agents,
    lastActivityAt: lastByWorkspace[workspace.id] || workspace.updatedAt,
  }));
}

export async function setUserStatus(id, status, { actorId } = {}) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw httpError(404, "User not found");
  }
  if (user.role === "ADMIN") {
    throw httpError(400, "The platform admin cannot be suspended");
  }
  if (actorId && actorId === user.id) {
    throw httpError(400, "You cannot change your own status");
  }
  if (user.status === status) return user;

  const updated = await prisma.user.update({
    where: { id },
    data: { status },
  });
  if (status === "ACTIVE") {
    await approvePendingRestoreRequestsForUser(id);
  }
  return updated;
}
