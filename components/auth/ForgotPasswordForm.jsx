"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { formatApiError } from "@/lib/utils/api-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (err) {
      setError(formatApiError(err, "Unable to send reset code"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <Alert>
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>
            If an account exists for that address, we sent a 6-digit code. It
            expires in 5 minutes. Then continue to reset your password.
          </AlertDescription>
        </Alert>
        <Button asChild className="h-11 w-full">
          <Link
            href={`/reset-password?email=${encodeURIComponent(email.trim())}`}
          >
            Enter code
          </Link>
        </Button>
        <p className="text-center text-sm text-[var(--landing-muted)]">
          <Link
            href="/login"
            className="font-medium text-[var(--landing-ink)] underline underline-offset-2"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
          <Input
            id="forgot-email"
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
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="h-11 w-full">
          {loading ? "Sending…" : "Send reset code"}
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
