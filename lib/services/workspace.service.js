import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_SLUG_COOKIE,
  workspaceCookieOptions,
} from "@/lib/workspace-cookie";
import { defaultWorkspaceNameFromUser, slugify } from "@/lib/utils/slugify";

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

async function setActiveCookie(workspace) {
  if (!workspace?.id) return;
  const jar = await cookies();
  const opts = workspaceCookieOptions();
  jar.set(WORKSPACE_COOKIE, workspace.id, opts);
  if (workspace.slug) {
    jar.set(WORKSPACE_SLUG_COOKIE, workspace.slug, opts);
  }
}

async function allocateSlug(userId, rawName, excludeId = null) {
  const base = slugify(rawName);
  let slug = base;
  let n = 2;
  while (n < 50) {
    const hit = await prisma.workspace.findFirst({
      where: {
        userId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!hit) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function hydrateWorkspaceIdentity(workspace, userId) {
  if (!workspace) return workspace;
  const genericName = workspace.name === DEFAULT_WORKSPACE_NAME;
  const expected = slugify(workspace.name);
  const slugStuck =
    workspace.slug === "default-workspace" && expected !== "default-workspace";
  if (!genericName && !slugStuck) return workspace;

  let name = workspace.name;
  if (genericName) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    name = defaultWorkspaceNameFromUser(user);
    const nameTaken = await prisma.workspace.findFirst({
      where: { userId, name, NOT: { id: workspace.id } },
      select: { id: true },
    });
    if (nameTaken) name = `${name} Workspace`.slice(0, 60);
  }

  const slug = await allocateSlug(userId, name, workspace.id);
  if (name === workspace.name && slug === workspace.slug) return workspace;

  try {
    return await prisma.workspace.update({
      where: { id: workspace.id },
      data: { name, slug },
    });
  } catch {
    return workspace;
  }
}

export async function ensureDefaultWorkspace(userId) {
  const existing = await prisma.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return hydrateWorkspaceIdentity(existing, userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const name = defaultWorkspaceNameFromUser(user);
  const slug = await allocateSlug(userId, name);

  try {
    return await prisma.workspace.create({
      data: { userId, name, slug },
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

export async function resolveActiveWorkspace(
  userId,
  { persistCookie = true } = {}
) {
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
  const active = await hydrateWorkspaceIdentity(
    fromCookie || workspaces[0],
    userId
  );

  // Cookie writes are only allowed in Route Handlers / Server Actions — not RSC pages.
  if (persistCookie) {
    await setActiveCookie(active);
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
      name: w.id === active.id ? active.name : w.name,
      slug: w.id === active.id ? active.slug : w.slug,
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
    slug: workspace.slug,
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
    const slug = await allocateSlug(userId, name);
    const workspace = await prisma.workspace.create({
      data: { userId, name, slug },
    });
    await setActiveCookie(workspace);
    return workspace;
  } catch (error) {
    if (error.code === "P2002") throw uniqueNameError();
    throw error;
  }
}

export async function updateWorkspaceForUser(id, userId, { name }) {
  await getWorkspaceForUser(id, userId);
  const newSlug = await allocateSlug(userId, name, id);
  try {
    const workspace = await prisma.workspace.update({
      where: { id },
      data: { name, slug: newSlug },
    });
    await setActiveCookie(workspace);
    return workspace;
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
    await setActiveCookie(remaining);
  }

  return {
    deleted: true,
    activeWorkspaceId: remaining?.id || null,
    slug: remaining?.slug || null,
  };
}

export async function resolveWorkspaceBySlug(userId, slug) {
  const workspace = await prisma.workspace.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  return workspace || null;
}

export async function activateWorkspaceForUser(id, userId) {
  const workspace = await getWorkspaceForUser(id, userId);
  await setActiveCookie(workspace);
  return { activeWorkspaceId: id, slug: workspace.slug };
}
