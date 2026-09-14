"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { formatApiError } from "@/lib/utils/api-error";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ initialEmail = "" }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords must match");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      router.push("/login?reset=1");
    } catch (err) {
      setError(formatApiError(err, "Unable to reset password"));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setResendNote("");
    setError("");
    setResendBusy(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setResendNote("If an account exists, a new code was sent.");
    } catch (err) {
      setError(formatApiError(err, "Unable to resend code"));
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reset-email">Email</FieldLabel>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-11"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reset-code">6-digit code</FieldLabel>
          <Input
            id="reset-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            disabled={loading}
            className="h-11 tracking-[0.28em] font-mono"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reset-password">New password</FieldLabel>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={loading}
            minLength={8}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reset-confirm">Confirm password</FieldLabel>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            minLength={8}
          />
        </Field>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {resendNote ? (
          <p className="text-sm text-[var(--landing-muted)]">{resendNote}</p>
        ) : null}
        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading ? "Updating…" : "Reset password"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={resendBusy || !email.trim()}
          onClick={resendCode}
        >
          {resendBusy ? "Sending…" : "Resend code"}
        </Button>
      </FieldGroup>
      <p className="text-center text-sm text-[var(--landing-muted)]">
        <Link
          href="/login"
          className="font-medium text-[var(--landing-ink)] underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
