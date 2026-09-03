"use client";

import { useEffect } from "react";

export default function AuthError({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <p className="auth-eyebrow">[ Error ]</p>
      <h2 className="landing-display mt-3 text-xl text-[var(--landing-ink)]">
        Something went wrong
      </h2>
      <p className="text-sm text-[#6B665C]">
        Please try again. If the problem continues, refresh the page.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-primary-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
