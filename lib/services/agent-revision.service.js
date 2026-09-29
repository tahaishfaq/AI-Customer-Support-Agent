/**
 * Level 2 · P5 — version history for an agent: list, view, restore. Reading needs agent read access;
 * restoring needs manage access and goes through the normal save (validation, white-label plan gate,
 * site-origin lock), so a restore can never do what a save could not.
 */

import prisma from "@/lib/prisma";
import { getAgentForUser, updateAgentForUser } from "@/lib/services/agent.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { updateAgentSchema } from "@/lib/validations/agent";
import {
  REVISION_FIELD_LABELS,
  changedFields,
  hashSnapshot,
  snapshotFromAgent,
  snapshotToPatch,
} from "@/lib/agents/revisions";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function parseVersion(version) {
  const n = Number(version);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) throw httpError(400, "Invalid version");
  return n;
}

/** Newest first, with what changed versus the version before and which one is live now. */
export async function listAgentRevisionsForUser(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  const rows = await prisma.agentRevision.findMany({
    where: { agentId },
    orderBy: { version: "desc" },
    take: 100,
    select: { version: true, snapshot: true, snapshotHash: true, note: true, createdByUserId: true, createdAt: true },
  });
  const liveHash = hashSnapshot(snapshotFromAgent(agent));
  const authorIds = [...new Set(rows.map((row) => row.createdByUserId).filter(Boolean))];
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const nameOf = new Map(authors.map((user) => [user.id, user.name || user.email]));
  const revisions = rows.map((row, index) => {
    const previous = rows[index + 1]?.snapshot || null;
    const changed = changedFields(previous, row.snapshot);
    return {
      version: row.version,
      createdAt: row.createdAt,
      note: row.note,
      author: row.createdByUserId ? nameOf.get(row.createdByUserId) || "Teammate" : null,
      changed: changed.map((field) => REVISION_FIELD_LABELS[field] || field),
      live: row.snapshotHash === liveHash,
    };
  });
  return { revisions };
}

export async function getAgentRevisionForUser(agentId, userId, version) {
  await getAgentForUser(agentId, userId);
  const row = await prisma.agentRevision.findUnique({
    where: { agentId_version: { agentId, version: parseVersion(version) } },
    select: { version: true, snapshot: true, note: true, createdAt: true },
  });
  if (!row) throw httpError(404, "Version not found");
  return row;
}

/** Restore = save the old snapshot as the agent's current settings (a new version; history kept). */
export async function restoreAgentRevisionForUser(agentId, userId, version) {
  await getAgentForUser(agentId, userId, { mutate: true });
  const n = parseVersion(version);
  const row = await prisma.agentRevision.findUnique({
    where: { agentId_version: { agentId, version: n } },
    select: { snapshot: true },
  });
  if (!row) throw httpError(404, "Version not found");

  // An old version is validated like a normal save; rules may have changed since it was kept.
  const parsed = updateAgentSchema.safeParse(snapshotToPatch(row.snapshot));
  if (!parsed.success) {
    throw httpError(422, "This version can't be restored with the current rules. Edit the agent instead.", {
      code: "REVISION_INVALID",
      issues: parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    });
  }
  const agent = await updateAgentForUser(agentId, userId, parsed.data, { revisionNote: `Restored version ${n}` });
  await writeAuditEvent({
    adminId: userId,
    action: "agent.revision.restore",
    targetType: "agent",
    targetId: agentId,
    metadata: { version: n },
  });
  return { agent, restoredVersion: n };
}
