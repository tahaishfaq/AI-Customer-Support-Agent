import "dotenv/config";

async function main() {
  const dryRun =
    process.argv.includes("--dry-run") ||
    process.env.EMAIL_RENEWAL_DRY_RUN === "1";
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
