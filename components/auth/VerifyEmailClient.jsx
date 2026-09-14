"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { formatApiError } from "@/lib/utils/api-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function VerifyEmailClient({ token = "" }) {
  const router = useRouter();
  const [status, setStatus] = useState(token ? "working" : "idle");
  const [error, setError] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return undefined;
    attempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        await apiFetch("/api/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        setStatus("ok");
        setTimeout(() => router.push("/auth/continue"), 1200);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(formatApiError(err, "Unable to verify email"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert className="border-[#E8E4DE] bg-[#FAF8F5] text-[#1A1814]">
          <AlertTitle className="text-[#1A1814]">Missing link</AlertTitle>
          <AlertDescription className="text-[#6B665C]">
            Open the verification link from your email, or request a new one
            after signing in.
          </AlertDescription>
        </Alert>
        <Button asChild variant="solid" className="h-11 w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (status === "working") {
    return (
      <div className="flex items-center gap-3 text-sm text-[#6B665C]">
        <Spinner className="size-4" />
        Verifying your email…
      </div>
    );
  }

  if (status === "ok") {
    return (
      <Alert className="border-[#E8E4DE] bg-[#FAF8F5] text-[#1A1814]">
        <AlertTitle className="text-[#1A1814]">Email verified</AlertTitle>
        <AlertDescription className="text-[#6B665C]">
          Taking you to your workspace…
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border-red-200 bg-red-50 text-red-900">
        <AlertTitle className="text-red-950">Could not verify</AlertTitle>
        <AlertDescription className="text-red-800/90">{error}</AlertDescription>
      </Alert>
      <p className="text-sm text-[#6B665C]">
        Resend from the app banner for a fresh link — older emails stop working
        after you request a new one.
      </p>
      <Button asChild variant="solid" className="h-11 w-full">
        <Link href="/auth/continue">Continue to app</Link>
      </Button>
      <Button asChild variant="outline" className="h-11 w-full border-[#D9D4CC] text-[#1A1814]">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
