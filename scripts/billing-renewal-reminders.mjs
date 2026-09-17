import "dotenv/config";

/**
 * Renewal reminder cron.
 * Default: run inline.
 * With BULLMQ_ENABLED=1 (and no --inline): enqueue idempotent sweep job for the worker.
 */
async function main() {
  const dryRun =
    process.argv.includes("--dry-run") ||
    process.env.EMAIL_RENEWAL_DRY_RUN === "1";
  const forceInline = process.argv.includes("--inline");
  const preferQueue =
    !forceInline &&
    ["1", "true", "yes"].includes(
      String(process.env.BULLMQ_ENABLED || "")
        .trim()
        .toLowerCase()
    );

  if (preferQueue) {
    const { enqueueRenewalReminderSweep } = await import(
      "../lib/jobs/enqueue.js"
    );
    const queued = await enqueueRenewalReminderSweep({ dryRun });
    if (queued.ok) {
      console.log(
        JSON.stringify({
          ok: true,
          queued: true,
          jobId: queued.jobId,
          dryRun,
        })
      );
      return;
    }
    console.warn(
      JSON.stringify({
        event: "enqueue_failed_fallback_inline",
        reason: queued.reason,
      })
    );
  }

  const mod = await import("../lib/billing/renewal-reminders.js");
  const listRenewalRemindersDue =
    mod.listRenewalRemindersDue || mod.default?.listRenewalRemindersDue;
  if (typeof listRenewalRemindersDue !== "function") {
    throw new Error(
      `listRenewalRemindersDue missing; exports=${Object.keys(mod).join(",")}`
    );
  }
  const result = await listRenewalRemindersDue({ dryRun });
  console.log(
    JSON.stringify(
      {
        ok: true,
        queued: false,
        dryRun,
        dueCount: result.due.length,
        sent: result.sent,
        skipped: result.skipped,
        due: result.due.slice(0, 50),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
