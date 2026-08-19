"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { homePathForRole } from "@/lib/auth-home";
import { apiFetch } from "@/lib/api-client";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordInput } from "@/components/auth/PasswordInput";

const fieldClass =
  "h-12 w-full rounded-xl border border-[#e2e8f0] bg-white px-4 text-[15px] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-60";

const labelClass = "mb-2 block text-sm font-medium text-[#0f172a]";

export function LoginForm({ variant = "user" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [appeal, setAppeal] = useState("");
  const [appealSent, setAppealSent] = useState(false);
  const [appealBusy, setAppealBusy] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState(null);
  const isAdmin = variant === "admin";

  useEffect(() => {
    if (searchParams.get("suspended") !== "1") return;
    logout();
    setSuspended(true);
    setRestoreStatus(null);
    setError("");
  }, [searchParams, logout]);

  function goHome(user) {
    const path = isAdmin ? "/admin" : homePathForRole(user?.role);
    router.push(path);
    router.refresh();
  }

  function markSuspended(status) {
    setSuspended(true);
    setRestoreStatus(status || null);
    setAppealSent(status === "PENDING");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(email.trim(), password);
      if (isAdmin && user?.role !== "ADMIN") {
        await useAuthStore.getState().logout();
        setError("This account is not the platform admin.");
        return;
      }
      goHome(user);
    } catch (err) {
      if (err.code === "SUSPENDED") markSuspended(err.restoreStatus);
      else setError(err.message || "Unable to login");
    } finally {
      setLoading(false);
    }
  }

  async function submitAppeal(event) {
    event.preventDefault();
    setAppealBusy(true);
    setError("");
    try {
      await apiFetch("/api/auth/restore-request", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), message: appeal }),
      });
      setAppealSent(true);
      setRestoreStatus("PENDING");
    } catch (err) {
      setError(err.message || "Unable to send request");
    } finally {
      setAppealBusy(false);
    }
  }

  if (suspended && !isAdmin) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3">
          <p className="text-sm font-medium text-[#991b1b]">
            {restoreStatus === "REJECTED"
              ? "This account is still suspended. Your restore request was rejected."
              : "This account was disabled by an admin."}
          </p>
          <p className="mt-1 text-[13px] text-[#b91c1c]">
            {restoreStatus === "REJECTED"
              ? "You cannot sign in. You can send a new request below."
              : restoreStatus === "PENDING"
                ? "Your request is waiting for an admin review."
                : "You cannot sign in until the operator restores access. Send a short request below."}
          </p>
        </div>

        {appealSent ? (
          <p className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">
            Request sent. An admin will review it. You can update it by sending
            again.
          </p>
        ) : (
          <form onSubmit={submitAppeal} className="space-y-4">
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="me@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={appealBusy}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="appeal" className={labelClass}>
                Message to admin
              </label>
              <textarea
                id="appeal"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={appeal}
                onChange={(e) => setAppeal(e.target.value)}
                disabled={appealBusy}
                placeholder="Why should this account be restored?"
                className="w-full rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-[15px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-60"
              />
            </div>
            {error ? (
              <p className="text-sm text-[#dc2626]" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={appealBusy}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--color-primary)] text-[15px] font-medium text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              {appealBusy ? "Sending…" : "Request access"}
            </button>
          </form>
        )}

        <button
          type="button"
          className="w-full text-center text-sm font-medium text-[var(--color-primary)] underline underline-offset-2"
          onClick={() => {
            setSuspended(false);
            setAppealSent(false);
            setRestoreStatus(null);
            setError("");
          }}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin ? null : (
        <>
          <GoogleSignInButton
            text="signin_with"
            onSuccess={(user) => goHome(user)}
            onError={(message, err) => {
              if (err?.email) setEmail(err.email);
              if (err?.code === "SUSPENDED") markSuspended(err.restoreStatus);
              else setError(message);
            }}
          />
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-[#e2e8f0]" />
            <span className="text-xs text-[#64748b]">or</span>
            <div className="h-px flex-1 bg-[#e2e8f0]" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="me@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        {error ? (
          <p className="text-sm text-[#dc2626]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--color-primary)] text-[15px] font-medium text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>

      {isAdmin ? null : (
        <p className="pt-2 text-center text-sm text-[#475569]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-[var(--color-primary)] underline underline-offset-2"
          >
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
