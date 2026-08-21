"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

const SCRIPT_ID = "google-gsi-script";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GIS_TIMEOUT_MS = 2500;

function ensureGisScript() {
  let script = document.getElementById(SCRIPT_ID);
  if (script) return script;

  script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);
  return script;
}

function gisReady() {
  return Boolean(window.google?.accounts?.id);
}

export function GoogleSignInButton({
  onError,
  onSuccess,
  text = "continue_with",
}) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  const paintedRef = useRef(false);
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;
  }, [onError, onSuccess]);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return undefined;

    let cancelled = false;
    let pollId = 0;
    let timeoutId = 0;
    paintedRef.current = false;

    function paint() {
      if (cancelled || paintedRef.current) return;
      if (!gisReady() || !buttonRef.current) return;

      const width = Math.min(
        Math.floor(containerRef.current?.offsetWidth || 360),
        400
      );
      if (width < 40) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            onErrorRef.current?.("Google sign-in failed");
            return;
          }

          setBusy(true);
          try {
            const user = await loginWithGoogle(response.credential);
            onSuccessRef.current?.(user);
          } catch (error) {
            onErrorRef.current?.(
              error.message || "Google sign-in failed",
              error
            );
          } finally {
            setBusy(false);
          }
        },
      });

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text,
        shape: "rectangular",
        logo_alignment: "left",
        width,
      });
      paintedRef.current = true;
      setStatus("ready");
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
    }

    function failIfGisMissing() {
      if (cancelled || paintedRef.current || gisReady()) return;
      setStatus("error");
      window.clearInterval(pollId);
    }

    const script = ensureGisScript();
    script.addEventListener("load", paint);
    script.addEventListener("error", failIfGisMissing);

    if (gisReady()) paint();

    pollId = window.setInterval(paint, 100);
    timeoutId = window.setTimeout(failIfGisMissing, GIS_TIMEOUT_MS);

    const resize = new ResizeObserver(() => paint());
    if (containerRef.current) resize.observe(containerRef.current);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      resize.disconnect();
      script.removeEventListener("load", paint);
      script.removeEventListener("error", failIfGisMissing);
    };
  }, [clientId, loginWithGoogle, text]);

  if (!clientId) {
    return (
      <p className="text-center text-sm text-[var(--color-muted)]">
        Google Sign-In is not configured.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <div
        ref={buttonRef}
        className={`flex min-h-10 w-full justify-center ${busy ? "pointer-events-none opacity-60" : ""}`}
        aria-busy={status === "loading"}
      />
      {status === "loading" ? (
        <p className="text-center text-sm text-[var(--color-muted)]">
          Loading Google…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-center text-sm text-[var(--color-muted)]">
          Continue with Google unavailable. Use email instead.
        </p>
      ) : null}
    </div>
  );
}
