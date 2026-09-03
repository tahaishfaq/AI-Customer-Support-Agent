import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "@/lib/workspace-cookie";

export const DEFAULT_WORKSPACE_NAME = "Default Workspace";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function uniqueNameError() {
  return httpError(409, "A workspace with this name already exists", {
    name: "Must be unique for your account",
  });
}

export async function ensureDefaultWorkspace(userId) {
  const existing = await prisma.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  try {
    return await prisma.workspace.create({
      data: { userId, name: DEFAULT_WORKSPACE_NAME },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return prisma.workspace.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
    }
    throw error;
  }
}

async function setActiveCookie(workspaceId) {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, workspaceId, workspaceCookieOptions());
}

export async function resolveActiveWorkspace(userId) {
  const list = await prisma.workspace.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  let workspaces = list;
  if (workspaces.length === 0) {
    const created = await ensureDefaultWorkspace(userId);
    workspaces = created ? [created] : [];
  }

  if (workspaces.length === 0) {
    throw httpError(500, "Unable to resolve workspace");
  }

  const jar = await cookies();
  const cookieId = jar.get(WORKSPACE_COOKIE)?.value;
  const fromCookie = cookieId
    ? workspaces.find((w) => w.id === cookieId)
    : null;
  const active = fromCookie || workspaces[0];

  if (!fromCookie) {
    await setActiveCookie(active.id);
  }

  return active;
}

export async function listWorkspacesForUser(userId) {
  await ensureDefaultWorkspace(userId);
  const [workspaces, active] = await Promise.all([
    prisma.workspace.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { agents: true } } },
    }),
    resolveActiveWorkspace(userId),
  ]);

  return {
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      agentCount: w._count.agents,
    })),
    activeWorkspaceId: active.id,
  };
}

export async function getWorkspaceForUser(id, userId) {
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: { _count: { select: { agents: true } } },
  });

  if (!workspace) {
    throw httpError(404, "Workspace not found");
  }
  if (workspace.userId !== userId) {
    throw httpError(403, "Not allowed to access this workspace");
  }

  return {
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    agentCount: workspace._count.agents,
  };
}

export async function createWorkspaceForUser(userId, { name }, { role } = {}) {
  const { assertCanCreateWorkspace, getUserRole } = await import(
    "@/lib/billing/entitlements.service"
  );
  const userRole = role || (await getUserRole(userId));
  await assertCanCreateWorkspace(userId, userRole);

  const count = await prisma.workspace.count({ where: { userId } });
  const { getPlatformSettings } = await import(
    "@/lib/services/platform-settings.service"
  );
  const settings = await getPlatformSettings();
  if (
    settings.maxWorkspacesPerUser > 0 &&
    count >= settings.maxWorkspacesPerUser
  ) {
    throw httpError(
      400,
      `You can have at most ${settings.maxWorkspacesPerUser} workspaces`
    );
  }

  try {
    const workspace = await prisma.workspace.create({
      data: { userId, name },
    });
    await setActiveCookie(workspace.id);
    return workspace;
  } catch (error) {
    if (error.code === "P2002") throw uniqueNameError();
    throw error;
  }
}

export async function updateWorkspaceForUser(id, userId, { name }) {
  await getWorkspaceForUser(id, userId);
  try {
    return await prisma.workspace.update({
      where: { id },
      data: { name },
    });
  } catch (error) {
    if (error.code === "P2002") throw uniqueNameError();
    throw error;
  }
}

export async function deleteWorkspaceForUser(id, userId, { confirm } = {}) {
  const workspace = await getWorkspaceForUser(id, userId);
  const total = await prisma.workspace.count({ where: { userId } });
  if (total <= 1) {
    throw httpError(400, "You must keep at least one workspace");
  }

  if (workspace.agentCount > 0 && !confirm) {
    throw httpError(
      400,
      "Workspace has agents. Pass confirm: true to delete the workspace and its agents.",
      { agentCount: workspace.agentCount }
    );
  }

  await prisma.workspace.delete({ where: { id } });

  const remaining = await prisma.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (remaining) {
    await setActiveCookie(remaining.id);
  }

  return { deleted: true, activeWorkspaceId: remaining?.id || null };
}

export async function activateWorkspaceForUser(id, userId) {
  await getWorkspaceForUser(id, userId);
  await setActiveCookie(id);
  return { activeWorkspaceId: id };
}
