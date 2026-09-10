import prisma from "@/lib/prisma";
import {
  actionConfigurationHash,
  actionSnapshot,
} from "@/lib/services/action-revision.service";

const apply = process.argv.includes("--apply");

async function main() {
  const actions = await prisma.agentAction.findMany({
    where: { revisions: { none: {} } },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  for (const action of actions) {
    const snapshot = actionSnapshot(action);
    const data = {
      actionId: action.id,
      revision: 1,
      state: "VALIDATED",
      configurationHash: actionConfigurationHash(snapshot),
      ...snapshot,
    };
    if (apply) {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.actionRevision.findUnique({
          where: { actionId_revision: { actionId: action.id, revision: 1 } },
          select: { id: true },
        });
        if (!existing) await tx.actionRevision.create({ data });
      });
    }
    created += 1;
  }

  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      candidates: actions.length,
      created: apply ? created : 0,
      next: apply
        ? "Review VALIDATED revisions, then publish explicitly per action."
        : "Re-run with --apply after migration review to create VALIDATED revisions.",
    })
  );
}

main()
  .catch((error) => {
    console.error(error?.message || "Action revision backfill failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
