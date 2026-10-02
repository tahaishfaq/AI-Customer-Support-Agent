import { ApiKeysPanel } from "@/components/developer/ApiKeysPanel";
import { WebhooksPanel } from "@/components/developer/WebhooksPanel";

export const metadata = {
  title: "Developers — AIDE",
};

/** Level 2 · P7 — API keys and webhooks for the active workspace (Owner/Admin). */
export default function SettingsDevelopersPage() {
  return (
    <main className="aide-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-text)] sm:text-2xl">
          Developers
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Connect AIDE to your own systems with a read-only API and signed webhooks.
        </p>
      </header>
      <div className="mt-6 flex max-w-3xl flex-col gap-6">
        <ApiKeysPanel />
        <WebhooksPanel />
      </div>
    </main>
  );
}
