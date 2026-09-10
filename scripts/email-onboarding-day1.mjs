import "dotenv/config";

async function main() {
  const dryRun =
    process.argv.includes("--dry-run") ||
    process.env.EMAIL_ONBOARDING_DRY_RUN === "1";
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
