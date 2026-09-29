/**
 * Level 2 · P5 — writes agent versions after a successful save. Kept apart from agent.service so
 * the save path imports it without a cycle. Best effort: a history write never fails the save.
 */

import prisma from "@/lib/prisma";
import { safeLogError } from "@/lib/observability/safe-log";
import { MAX_REVISIONS, hashSnapshot, snapshotFromAgent } from "@/lib/agents/revisions";

function isUniqueViolation(error) {
  return error?.code === "P2002";
}

async function appendRevision(agentId, snapshot, { userId = null, note = null } = {}) {
  const snapshotHash = hashSnapshot(snapshot);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const latest = await prisma.agentRevision.findFirst({
      where: { agentId },
      orderBy: { version: "desc" },
      select: { version: true, snapshotHash: true },
    });
    // Same content as the newest version (e.g. saved twice): nothing new to keep.
    if (latest?.snapshotHash === snapshotHash) return null;
    try {
      return await prisma.agentRevision.create({
        data: {
          agentId,
          version: (latest?.version || 0) + 1,
          snapshot,
          snapshotHash,
          note: note ? String(note).slice(0, 200) : null,
          createdByUserId: userId,
        },
        select: { version: true },
      });
    } catch (error) {
      // Two saves at once took the same number: re-read and try once more.
      if (!isUniqueViolation(error) || attempt === 1) throw error;
    }
  }
  return null;
}

async function pruneRevisions(agentId) {
  const stale = await prisma.agentRevision.findMany({
    where: { agentId },
    orderBy: { version: "desc" },
    skip: MAX_REVISIONS,
    select: { id: true },
  });
  if (stale.length) {
    await prisma.agentRevision.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  }
}

/**
 * After a save: the first time, keep the state before the edit too, so the owner can always go
 * back to where they started; then keep the saved state when it changed.
 */
export async function recordAgentRevision({ before, after, userId = null, note = null }) {
  try {
    const agentId = after?.id || before?.id;
    if (!agentId) return null;
    const beforeSnapshot = snapshotFromAgent(before);
    const afterSnapshot = snapshotFromAgent(after);
    if (hashSnapshot(beforeSnapshot) === hashSnapshot(afterSnapshot)) return null;

    const hasHistory = await prisma.agentRevision.count({ where: { agentId } });
    if (!hasHistory) {
      await appendRevision(agentId, beforeSnapshot, { note: "Before the first saved change" });
    }
    const created = await appendRevision(agentId, afterSnapshot, { userId, note });
    await pruneRevisions(agentId);
    return created;
  } catch (error) {
    safeLogError("agent revision write failed", {
      agentId: after?.id || before?.id || null,
      code: error?.code || "REVISION_WRITE_FAILED",
    });
    return null;
  }
}
