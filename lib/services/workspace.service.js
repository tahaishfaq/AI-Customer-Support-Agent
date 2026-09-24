import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_SLUG_COOKIE,
  workspaceCookieOptions,
} from "@/lib/workspace-cookie";
import { defaultWorkspaceNameFromUser, slugify } from "@/lib/utils/slugify";
import {
  resolveWorkspaceAccess,
  roleAllowsWorkspaceRead,
  serializeWorkspaceAccessSummary,
} from "@/lib/workspace-authz";

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

/** Owner rows already ensured by this process — skips an idempotent upsert on every request. */
const ensuredOwnerMemberships = new Set();

async function ensureOwnerMembership(workspaceId, userId) {
  if (!workspaceId || !userId) return null;
  const key = `${workspaceId}:${userId}`;
  if (ensuredOwnerMemberships.has(key)) return null;
  try {
    const row = await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      create: { workspaceId, userId, role: "OWNER" },
      update: {},
    });
    if (ensuredOwnerMemberships.size > 10_000) ensuredOwnerMemberships.clear();
    ensuredOwnerMemberships.add(key);
    return row;
  } catch {
    // Table may be absent until migrate deploy; owner path does not require the row.
    return null;
  }
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
 * Owned workspaces plus additive seat memberships (read-scoped).
 * Owner via Workspace.userId wins when both apply.
 */
async function listAccessibleWorkspaceEntries(userId) {
  const owned = await prisma.workspace.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const byId = new Map();
  for (const workspace of owned) {
    byId.set(workspace.id, {
      workspace,
      access: resolveWorkspaceAccess({ workspace, userId }),
    });
  }

  let memberRows = [];
  try {
    memberRows = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    memberRows = [];
  }

  for (const row of memberRows) {
    if (!row.workspace || byId.has(row.workspaceId)) continue;
    if (!roleAllowsWorkspaceRead(row.role)) continue;
    const access = resolveWorkspaceAccess({
      workspace: row.workspace,
      userId,
      membership: row,
    });
    if (!access.canRead) continue;
    byId.set(row.workspaceId, { workspace: row.workspace, access });
  }

  return [...byId.values()];
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

/**
 * Load workspace + access. Read via owner record or additive membership.
 * Mutations must pass `{ manage: true }` (owner record only for now).
 */
export async function assertWorkspaceAccess(
  id,
  userId,
  { manage = false } = {}
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: { _count: { select: { agents: true } } },
  });
  if (!workspace) {
    throw httpError(404, "Workspace not found");
  }

  const membership = await findMembership(id, userId);
  const access = resolveWorkspaceAccess({ workspace, userId, membership });
  if (!access.canRead) {
    throw httpError(403, "Not allowed to access this workspace");
  }
  if (manage && !access.canManage) {
    throw httpError(403, "Not allowed to manage this workspace");
  }
  // Task 8: mutations stay on billing-owner path (Workspace.userId).
  if (manage && access.via !== "owner") {
    throw httpError(403, "Not allowed to manage this workspace");
  }

  return { workspace, access, membership };
}

export async function ensureDefaultWorkspace(userId) {
  const existing = await prisma.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    const hydrated = await hydrateWorkspaceIdentity(existing, userId);
    await ensureOwnerMembership(hydrated.id, userId);
    return hydrated;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const name = defaultWorkspaceNameFromUser(user);
  const slug = await allocateSlug(userId, name);

  try {
    const created = await prisma.workspace.create({
      data: { userId, name, slug },
    });
    await ensureOwnerMembership(created.id, userId);
    return created;
  } catch (error) {
    if (error.code === "P2002") {
      const raced = await prisma.workspace.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      if (raced) await ensureOwnerMembership(raced.id, userId);
      return raced;
    }
    throw error;
  }
}

export async function resolveActiveWorkspace(
  userId,
  { persistCookie = true } = {}
) {
  await ensureDefaultWorkspace(userId);
  const entries = await listAccessibleWorkspaceEntries(userId);
  const workspaces = entries.map((e) => e.workspace);

  if (workspaces.length === 0) {
    throw httpError(500, "Unable to resolve workspace");
  }

  const jar = await cookies();
  const cookieId = jar.get(WORKSPACE_COOKIE)?.value;
  const fromCookie = cookieId
    ? workspaces.find((w) => w.id === cookieId)
    : null;
  // Hydrate identity only for owned workspaces (slug uniqueness is per owner).
  const candidate = fromCookie || workspaces[0];
  const active =
    candidate.userId === userId
      ? await hydrateWorkspaceIdentity(candidate, userId)
      : candidate;

  // Cookie writes are only allowed in Route Handlers / Server Actions — not RSC pages.
  if (persistCookie) {
    await setActiveCookie(active);
  }
  return active;
}

export async function listWorkspacesForUser(userId) {
  await ensureDefaultWorkspace(userId);
  const entries = await listAccessibleWorkspaceEntries(userId);
  const active = await resolveActiveWorkspace(userId);
  const ids = entries.map((e) => e.workspace.id);
  const countRows =
    ids.length === 0
      ? []
      : await prisma.agent.groupBy({
          by: ["workspaceId"],
          where: { workspaceId: { in: ids } },
          _count: { _all: true },
        });
  const countById = new Map(
    countRows.map((row) => [row.workspaceId, row._count._all])
  );

  return {
    workspaces: entries.map(({ workspace, access }) => {
      const w =
        workspace.id === active.id && active.userId === userId
          ? { ...workspace, name: active.name, slug: active.slug }
          : workspace;
      return serializeWorkspaceAccessSummary(
        { ...w, agentCount: countById.get(w.id) || 0 },
        access
      );
    }),
    activeWorkspaceId: active.id,
  };
}

export async function getWorkspaceForUser(id, userId) {
  const { workspace, access } = await assertWorkspaceAccess(id, userId);
  return serializeWorkspaceAccessSummary(
    {
      ...workspace,
      agentCount: workspace._count?.agents ?? 0,
    },
    access
  );
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
    await ensureOwnerMembership(workspace.id, userId);
    await setActiveCookie(workspace);
    return workspace;
  } catch (error) {
    if (error.code === "P2002") throw uniqueNameError();
    throw error;
  }
}

export async function updateWorkspaceForUser(id, userId, { name }) {
  await assertWorkspaceAccess(id, userId, { manage: true });
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
  const { workspace } = await assertWorkspaceAccess(id, userId, {
    manage: true,
  });
  const total = await prisma.workspace.count({ where: { userId } });
  if (total <= 1) {
    throw httpError(400, "You must keep at least one workspace");
  }

  const agentCount = workspace._count?.agents ?? 0;
  if (agentCount > 0 && !confirm) {
    throw httpError(
      400,
      "Workspace has agents. Pass confirm: true to delete the workspace and its agents.",
      { agentCount }
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
  const owned = await prisma.workspace.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (owned) return owned;

  // Member may land on /ws/:slug for a workspace they do not own.
  const entries = await listAccessibleWorkspaceEntries(userId);
  return entries.find((e) => e.workspace.slug === slug)?.workspace || null;
}

export async function activateWorkspaceForUser(id, userId) {
  const { workspace } = await assertWorkspaceAccess(id, userId);
  await setActiveCookie(workspace);
  return { activeWorkspaceId: id, slug: workspace.slug };
}
