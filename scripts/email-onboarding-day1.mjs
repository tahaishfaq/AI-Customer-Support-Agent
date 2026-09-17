import "dotenv/config";

/**
 * Onboarding day-1 nudge cron.
 * Default: run inline.
 * With BULLMQ_ENABLED=1 (and no --inline): enqueue idempotent sweep job for the worker.
 */
async function main() {
  const dryRun =
    process.argv.includes("--dry-run") ||
    process.env.EMAIL_ONBOARDING_DRY_RUN === "1";
  const forceInline = process.argv.includes("--inline");
  const preferQueue =
    !forceInline &&
    ["1", "true", "yes"].includes(
      String(process.env.BULLMQ_ENABLED || "")
        .trim()
        .toLowerCase()
    );

  if (preferQueue) {
    const { enqueueOnboardingDay1Sweep } = await import(
      "../lib/jobs/enqueue.js"
    );
    const queued = await enqueueOnboardingDay1Sweep({ dryRun });
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

  const mod = await import("../lib/services/email-lifecycle.service.js");
  const sendOnboardingDay1Nudges =
    mod.sendOnboardingDay1Nudges || mod.default?.sendOnboardingDay1Nudges;
  if (typeof sendOnboardingDay1Nudges !== "function") {
    throw new Error("sendOnboardingDay1Nudges missing");
  }
  const result = await sendOnboardingDay1Nudges({ dryRun });
  console.log(
    JSON.stringify(
      {
        ok: true,
        queued: false,
        dryRun,
        dueCount: result.due?.length || 0,
        sent: result.sent,
        skipped: result.skipped,
        disabled: result.disabled || false,
        due: (result.due || []).slice(0, 50),
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
