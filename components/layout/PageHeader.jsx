export function PageHeader({ title, description, actions }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-semibold tracking-tight text-[var(--color-text)] sm:text-[length:var(--text-2xl)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-[var(--color-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
