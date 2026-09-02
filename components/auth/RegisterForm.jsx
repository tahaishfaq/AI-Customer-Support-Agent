"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { homePathForRole } from "@/lib/auth-home";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { formatApiError } from "@/lib/utils/api-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [signupsEnabled, setSignupsEnabled] = useState(true);

  useEffect(() => {
    const preset = searchParams.get("email");
    if (preset) setEmail(preset);
  }, [searchParams]);

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
    setFieldErrors({});

    if (password.length < 8) {
      setFieldErrors({ password: "At least 8 characters" });
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords must match" });
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
      if (err.details && Object.keys(err.details).length) {
        setFieldErrors(err.details);
      } else {
        setError(formatApiError(err, "Unable to register"));
      }
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
      <Alert>
        <AlertDescription>
          Signups closed.{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-2"
          >
            Log in
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <GoogleSignInButton
        text="signup_with"
        onSuccess={(user) => goHome(user)}
        onError={(message) => setError(message)}
      />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field data-invalid={Boolean(fieldErrors.name) || undefined}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className="h-11"
            />
            {fieldErrors.name ? (
              <FieldError>{fieldErrors.name}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(fieldErrors.email) || undefined}>
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
            {fieldErrors.email ? (
              <FieldError>{fieldErrors.email}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(fieldErrors.password) || undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
            />
            {fieldErrors.password ? (
              <FieldError>{fieldErrors.password}</FieldError>
            ) : null}
          </Field>
          <Field
            data-invalid={Boolean(fieldErrors.confirmPassword) || undefined}
          >
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
            {fieldErrors.confirmPassword ? (
              <FieldError>{fieldErrors.confirmPassword}</FieldError>
            ) : null}
          </Field>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="h-11 w-full">
            {loading ? "Creating account…" : "Register"}
          </Button>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline underline-offset-2"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
