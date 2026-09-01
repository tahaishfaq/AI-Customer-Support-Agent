"use client";

import { useEffect } from "react";

export default function AuthError({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <h2 className="landing-display text-xl text-[var(--landing-ink)]">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--landing-muted)]">
        Please try again. If the problem continues, refresh the page.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-primary-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
