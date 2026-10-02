/**
 * Active workspace + the caller's access, for workspace-level settings (webhooks, API keys).
 * Owners and Admins manage; other members get 403; non-members never reach here (active workspace).
 */

import prisma from "@/lib/prisma";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";
import { isWorkspaceOwnerRecord, resolveWorkspaceAccess } from "@/lib/workspace-authz";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function resolveWorkspaceForManager(userId, { need = "manage" } = {}) {
  const workspace = await resolveActiveWorkspace(userId);
  const membership = isWorkspaceOwnerRecord(workspace, userId)
    ? null
    : await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
        select: { workspaceId: true, userId: true, role: true },
      });
  const access = resolveWorkspaceAccess({ workspace, userId, membership });
  if (!access.canRead) throw httpError(404, "Workspace not found");
  if (need === "manage" && !access.canManage) {
    throw httpError(403, "Only workspace owners and admins can manage API keys and webhooks");
  }
  return { workspace, access };
}
