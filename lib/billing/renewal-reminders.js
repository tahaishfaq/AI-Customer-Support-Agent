import prisma from "@/lib/prisma";
import { isEmailConfigured } from "@/lib/email/client";
import { notifyRenewalUpcoming } from "@/lib/email/billing-notify";

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Paid ACTIVE subs renewing in ~3 days, not canceling.
 * @returns {{ due: Array, sent: number, skipped: number }}
 */
export async function listRenewalRemindersDue({
  now = new Date(),
  windowDays = 3,
  dryRun = false,
} = {}) {
  const start = new Date(now.getTime() + (windowDays - 0.5) * MS_DAY);
  const end = new Date(now.getTime() + (windowDays + 0.5) * MS_DAY);

  const rows = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: {
        gte: start,
        lte: end,
      },
      plan: {
        planType: { not: "FREE" },
      },
    },
    include: {
      plan: true,
      user: { select: { id: true, email: true, name: true } },
    },
    take: 500,
  });

  const due = rows.map((row) => ({
    subscriptionId: row.id,
    userId: row.userId,
    email: row.user?.email || null,
    planName: row.plan?.name || null,
    periodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  }));

  if (dryRun) {
    return { due, sent: 0, skipped: due.length, dryRun: true };
  }

  let sent = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await notifyRenewalUpcoming({
      userId: row.userId,
      subscriptionId: row.id,
      plan: row.plan,
      periodEnd: row.currentPeriodEnd,
    });
    if (result?.skipped) skipped += 1;
    else if (result?.ok) sent += 1;
    else skipped += 1;
  }

  return { due, sent, skipped, dryRun: false };
}

export function emailHealthFlag() {
  return isEmailConfigured() ? "configured" : "unconfigured";
}
