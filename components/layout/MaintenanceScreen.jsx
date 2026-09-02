export function MaintenanceScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="max-w-md rounded-2xl border border-[var(--color-border)] bg-white px-6 py-8 text-center shadow-[var(--shadow-card)]">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)]">
          Aide is under maintenance
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          The product console is temporarily unavailable. Your public widgets
          keep working unless an admin also turns on the embed kill switch.
        </p>
      </div>
    </main>
  );
}
