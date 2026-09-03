"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { resolveFastPostAuthPath } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api-client";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { formatApiError } from "@/lib/utils/api-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export function LoginForm({
  sessionExpired = false,
  suspended: suspendedProp = false,
  next = "",
}) {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(suspendedProp);
  const [appeal, setAppeal] = useState("");
  const [appealSent, setAppealSent] = useState(false);
  const [appealBusy, setAppealBusy] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState(null);
  const clearedRef = useRef(false);

  if (!clearedRef.current && (sessionExpired || suspendedProp)) {
    clearedRef.current = true;
    queueMicrotask(() => logout());
  }

  function goHome(user) {
    const dest = resolveFastPostAuthPath(user, next);
    router.push(dest);
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
      goHome(user);
    } catch (err) {
      if (err.code === "SUSPENDED") markSuspended(err.restoreStatus);
      else setError(formatApiError(err, "Unable to login"));
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
      setError(formatApiError(err, "Unable to send request"));
    } finally {
      setAppealBusy(false);
    }
  }

  if (suspended) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertTitle>
            {restoreStatus === "REJECTED"
              ? "Account still suspended"
              : "Account disabled"}
          </AlertTitle>
          <AlertDescription>
            {restoreStatus === "REJECTED"
              ? "Your restore request was rejected. You can send a new request below."
              : restoreStatus === "PENDING"
                ? "Your request is waiting for an admin review."
                : "You cannot sign in until an operator restores access."}
          </AlertDescription>
        </Alert>

        {appealSent ? (
          <Alert>
            <AlertDescription>
              Request sent. An admin will review it. You can update it by sending
              again.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={submitAppeal}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="me@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={appealBusy}
                  className="h-11"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="appeal">Message to admin</FieldLabel>
                <Textarea
                  id="appeal"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  value={appeal}
                  onChange={(e) => setAppeal(e.target.value)}
                  disabled={appealBusy}
                  placeholder="Why should this account be restored?"
                />
              </Field>
              {error ? <FieldError>{error}</FieldError> : null}
              <Button type="submit" disabled={appealBusy} className="h-11 w-full">
                {appealBusy ? "Sending…" : "Request access"}
              </Button>
            </FieldGroup>
          </form>
        )}

        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          onClick={() => {
            setSuspended(false);
            setAppealSent(false);
            setRestoreStatus(null);
            setError("");
          }}
        >
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sessionExpired ? (
        <Alert>
          <AlertTitle>Session expired</AlertTitle>
          <AlertDescription>
            Your previous sign-in is no longer valid. Sign in again to continue.
          </AlertDescription>
        </Alert>
      ) : null}

      <GoogleSignInButton
        text="signin_with"
        onSuccess={(user) => goHome(user)}
        onError={(message, err) => {
          if (err?.email) setEmail(err.email);
          if (err?.code === "SUSPENDED") markSuspended(err.restoreStatus);
          else setError(message);
        }}
      />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-[11px] tracking-[0.08em] text-[var(--landing-muted)] uppercase">
          or
        </span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="me@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-11"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </Field>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="h-11 w-full">
            {loading ? "Signing in…" : "Log in"}
          </Button>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-[var(--landing-muted)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          prefetch
          className="font-medium text-[var(--landing-ink)] underline underline-offset-2 transition-opacity hover:opacity-70"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
