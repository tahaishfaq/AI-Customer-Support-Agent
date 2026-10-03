/**
 * Level 3 · L6 — retention deletes (settled only) + privacy settings helpers.
 */

import prisma from "@/lib/prisma";
import { safeLogError } from "@/lib/observability/safe-log";
import { normalizePrivacy } from "@/lib/privacy/redaction";

const BATCH = 25;

export async function previewRetentionCount(workspaceId, retentionDays) {
  if (!retentionDays) return 0;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  return prisma.conversation.count({
    where: {
      agent: { workspaceId },
      legalHold: false,
      isSimulation: false,
      messages: { every: { createdAt: { lt: cutoff } }, some: {} },
      OR: [{ endedAt: { lt: cutoff } }, { endedAt: null, startedAt: { lt: cutoff } }],
    },
  });
}

export async function runRetentionSweep(workspaceId) {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { privacy: true },
    });
    const privacy = normalizePrivacy(workspace?.privacy);
    if (!privacy.retentionDays) return { deleted: 0 };
    const cutoff = new Date(Date.now() - privacy.retentionDays * 24 * 60 * 60 * 1000);
    const rows = await prisma.conversation.findMany({
      where: {
        agent: { workspaceId },
        legalHold: false,
        isSimulation: false,
        messages: {
          every: { createdAt: { lt: cutoff } },
        },
      },
      select: { id: true },
      take: BATCH,
      orderBy: { startedAt: "asc" },
    });
    if (!rows.length) return { deleted: 0 };
    const result = await prisma.conversation.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    return { deleted: result.count };
  } catch (error) {
    safeLogError("runRetentionSweep failed", { code: error?.code || "retention_error" });
    return { deleted: 0 };
  }
}

export function scheduleRetentionSweep(workspaceId) {
  if (!workspaceId) return;
  const run = () => runRetentionSweep(workspaceId);
  import("next/server")
    .then(({ after }) => {
      try {
        after(() => run());
      } catch {
        void run();
      }
    })
    .catch(() => {
      void run();
    });
}
