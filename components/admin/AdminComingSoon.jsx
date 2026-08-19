import { PageHeader } from "@/components/layout/PageHeader";

export function AdminComingSoon({ title, description }) {
  return (
    <main className="hapy-page">
      <PageHeader title={title} description={description} />
      <div className="mt-6 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-14 text-center">
        <p className="text-sm font-medium text-[var(--color-text)]">
          Nothing here yet
        </p>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          This screen ships in the next admin phase.
        </p>
      </div>
    </main>
  );
}
