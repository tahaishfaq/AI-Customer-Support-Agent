"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { homePathForRole } from "@/lib/auth-home";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { formatApiError } from "@/lib/utils/api-error";

const fieldClass =
  "h-12 w-full rounded-xl border border-[#e2e8f0] bg-white px-4 text-[15px] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-60";

const labelClass = "mb-2 block text-sm font-medium text-[#0f172a]";

export function RegisterForm() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupsEnabled, setSignupsEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/platform")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.signupsEnabled === false) {
          setSignupsEnabled(false);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords must match");
      return;
    }

    setLoading(true);
    try {
      const user = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      router.push(homePathForRole(user?.role));
      router.refresh();
    } catch (err) {
      setError(formatApiError(err, "Unable to register"));
    } finally {
      setLoading(false);
    }
  }

  function goHome(user) {
    router.push(homePathForRole(user?.role));
    router.refresh();
  }

  if (!signupsEnabled) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#475569]">
          New signups are closed. If you already have an account, log in.
        </p>
        <p className="text-center text-sm text-[#475569]">
          <Link
            href="/login"
            className="font-medium text-[var(--color-primary)] underline underline-offset-2"
          >
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GoogleSignInButton
        text="signup_with"
        onSuccess={(user) => goHome(user)}
        onError={(message) => setError(message)}
      />

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-[#e2e8f0]" />
        <span className="text-xs text-[#64748b]">or</span>
        <div className="h-px flex-1 bg-[#e2e8f0]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input
            id="name"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            className={fieldClass}
          />
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className={labelClass}>
            Confirm password
          </label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Creating account…" : "Register"}
        </button>
      </form>

      <p className="text-center text-sm text-[#475569]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
