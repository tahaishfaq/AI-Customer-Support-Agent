"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordInput } from "@/components/auth/PasswordInput";

const fieldClass =
  "h-12 w-full rounded-xl border border-[#e2e8f0] bg-white px-4 text-[15px] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-60";

const labelClass = "mb-2 block text-sm font-medium text-[#0f172a]";

export function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message || "Unable to login");
    } finally {
      setLoading(false);
    }
  }

  function goDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <GoogleSignInButton
        text="signin_with"
        onSuccess={goDashboard}
        onError={(message) => setError(message)}
      />

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-[#e2e8f0]" />
        <span className="text-xs text-[#64748b]">or</span>
        <div className="h-px flex-1 bg-[#e2e8f0]" />
      </div>

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

      <p className="pt-2 text-center text-sm text-[#475569]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
