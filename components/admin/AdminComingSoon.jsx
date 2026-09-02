import { PageHeader } from "@/components/layout/PageHeader";

export function AdminComingSoon({ title, description }) {
  return (
    <main className="aide-page">
      <PageHeader title={title} description={description} />
      <div className="mt-6 rounded-xl border border-dashed border-border bg-card px-5 py-14 text-center">
        <p className="text-sm font-medium text-foreground">
          Nothing here yet
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          This screen ships in the next admin phase.
        </p>
      </div>
    </main>
  );
}
