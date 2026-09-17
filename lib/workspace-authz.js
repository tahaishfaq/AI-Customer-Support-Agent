/**
 * Workspace seat authz helpers (pure).
 * Workspace.userId remains the owner/billing authority.
 * Membership rows are additive — owners work with or without a WorkspaceMember row.
 */

export const WORKSPACE_MEMBER_ROLES = Object.freeze([
  "OWNER",
  "ADMIN",
  "MEMBER",
  "VIEWER",
]);

/** Roles that may read workspace metadata / list it. */
export const WORKSPACE_READ_ROLES = Object.freeze([
  "OWNER",
  "ADMIN",
  "MEMBER",
  "VIEWER",
]);

/** Roles that may mutate workspace settings (not billing owner transfer). */
export const WORKSPACE_MANAGE_ROLES = Object.freeze(["OWNER", "ADMIN"]);

/**
 * @param {{ userId?: string }|null|undefined} workspace
 * @param {string|null|undefined} userId
 */
export function isWorkspaceOwnerRecord(workspace, userId) {
  return Boolean(workspace?.userId && userId && workspace.userId === userId);
}

export function roleAllowsWorkspaceRead(role) {
  return WORKSPACE_READ_ROLES.includes(String(role || "").toUpperCase());
}

export function roleAllowsWorkspaceManage(role) {
  return WORKSPACE_MANAGE_ROLES.includes(String(role || "").toUpperCase());
}

/**
 * Resolve access for a workspace + optional membership row.
 * @param {{
 *   workspace: { id?: string, userId?: string }|null|undefined,
 *   userId: string|null|undefined,
 *   membership?: { workspaceId?: string, userId?: string, role?: string }|null,
 * }} opts
 */
export function resolveWorkspaceAccess({
  workspace = null,
  userId = null,
  membership = null,
} = {}) {
  if (!workspace?.id || !userId) {
    return {
      allowed: false,
      role: null,
      via: null,
      canRead: false,
      canManage: false,
    };
  }

  if (isWorkspaceOwnerRecord(workspace, userId)) {
    return {
      allowed: true,
      role: "OWNER",
      via: "owner",
      canRead: true,
      canManage: true,
    };
  }

  const role = String(membership?.role || "").toUpperCase() || null;
  const membershipMatches =
    membership &&
    membership.workspaceId === workspace.id &&
    membership.userId === userId &&
    roleAllowsWorkspaceRead(role);

  if (!membershipMatches) {
    return {
      allowed: false,
      role: null,
      via: null,
      canRead: false,
      canManage: false,
    };
  }

  return {
    allowed: true,
    role,
    via: "member",
    canRead: true,
    canManage: roleAllowsWorkspaceManage(role),
  };
}

/**
 * Serialize owner-facing workspace list item; membershipRole only for non-owners.
 */
export function serializeWorkspaceAccessSummary(workspace, access) {
  const base = {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    agentCount: workspace.agentCount ?? workspace._count?.agents ?? 0,
  };
  if (access?.via === "member" && access.role) {
    return { ...base, membershipRole: access.role };
  }
  return base;
}
