"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="hapy-page flex flex-col items-start justify-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
        Hapy admin
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-semibold text-[var(--color-text)]">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
        This admin view failed to render. Retry, or return to overview.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)]"
        >
          Overview
        </Link>
      </div>
    </main>
  );
}
