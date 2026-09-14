import "dotenv/config";

async function main() {
  const dryRun =
    process.argv.includes("--dry-run") ||
    process.env.BILLING_PERIOD_END_DRY_RUN === "1";
  const { applyDuePeriodEndTransitions } = await import(
    "../lib/billing/subscription.service.js"
  );

  if (dryRun) {
    const prisma = (await import("../lib/prisma.js")).default;
    const due = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: { lte: new Date() },
        plan: { planType: { not: "FREE" } },
      },
      select: {
        id: true,
        userId: true,
        planId: true,
        pendingPlanId: true,
        currentPeriodEnd: true,
        billingMode: true,
      },
      take: 100,
    });
    console.log(JSON.stringify({ ok: true, dryRun: true, dueCount: due.length, due }, null, 2));
    return;
  }

  const result = await applyDuePeriodEndTransitions();
  console.log(JSON.stringify({ ok: true, dryRun: false, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
