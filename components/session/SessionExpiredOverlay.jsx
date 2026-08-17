"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";

export function SessionExpiredOverlay() {
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const clearSessionExpired = useAuthStore((s) => s.clearSessionExpired);

  if (!sessionExpired) return null;

  function handleRefresh() {
    window.location.reload();
  }

  function handleSignIn() {
    clearSessionExpired();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/50 px-6 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-8 shadow-lg">
        <h2
          id="session-expired-title"
          className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[#0f172a]"
        >
          Session expired
        </h2>
        <p
          id="session-expired-desc"
          className="mt-3 text-[15px] leading-relaxed text-[#475569]"
        >
          Your session has ended. Refresh the page to continue if you still
          have a valid session, or sign in again.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleRefresh}
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] text-[15px] font-medium text-white transition hover:bg-[var(--color-primary-hover)]"
          >
            Refresh
          </button>
          <Link
            href="/login"
            onClick={handleSignIn}
            className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[15px] font-medium text-[#0f172a] transition hover:bg-[#f8fafc]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
