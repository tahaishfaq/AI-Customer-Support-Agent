"use client";

import { useEffect } from "react";

export default function AuthError({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#0f172a]">
        Something went wrong
      </h2>
      <p className="text-sm text-[#475569]">
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
