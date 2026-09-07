"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  getGoogleGisStatus,
  retryGoogleGisReady,
  subscribeGoogleGisStatus,
} from "@/lib/auth/google-gis";

function useGoogleGisStatus() {
  return useSyncExternalStore(
    subscribeGoogleGisStatus,
    getGoogleGisStatus,
    () => "idle"
  );
}

/** Stable GIS callback — one initialize per client id (no flicker / GSI warnings). */
const gisCredentialHandler = { current: null };
let gisClientIdInitialized = "";

function ensureGisInitialized(clientId) {
  if (typeof window === "undefined" || !window.google?.accounts?.id) {
    return false;
  }
  if (gisClientIdInitialized === clientId) return true;

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      void gisCredentialHandler.current?.(response);
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: false,
  });
  gisClientIdInitialized = clientId;
  return true;
}

function labelFor(text) {
  if (text === "signup_with") return "Sign up with Google";
  if (text === "signin_with") return "Sign in with Google";
  return "Continue with Google";
}

function GoogleMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * Full-width Google sign-in. GIS official button maxes at 400px, so we paint a
 * matching visual and stretch an invisible GIS layer across the full form width.
 */
export function GoogleSignInButton({
  onError,
  onSuccess,
  text = "continue_with",
}) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const gisStatus = useGoogleGisStatus();
  const shellRef = useRef(null);
  const hostRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  const loginRef = useRef(loginWithGoogle);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;
  loginRef.current = loginWithGoogle;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const label = labelFor(text);

  useLayoutEffect(() => {
    if (!clientId) return;
    if (gisStatus !== "ready") retryGoogleGisReady();
  }, [clientId, gisStatus]);

  useEffect(() => {
    gisCredentialHandler.current = async (response) => {
      if (!response?.credential) {
        onErrorRef.current?.("Google sign-in failed");
        return;
      }
      setBusy(true);
      try {
        const user = await loginRef.current(response.credential);
        onSuccessRef.current?.(user);
      } catch (error) {
        setBusy(false);
        onErrorRef.current?.(error.message || "Google sign-in failed", error);
      }
    };
    return () => {
      gisCredentialHandler.current = null;
    };
  }, []);

  useEffect(() => {
    if (busy || gisStatus !== "ready" || !clientId) return;
    const shell = shellRef.current;
    const host = hostRef.current;
    if (!shell || !host || !window.google?.accounts?.id) return;
    if (!ensureGisInitialized(clientId)) return;

    let cancelled = false;

    function paint() {
      if (cancelled || !shellRef.current || !hostRef.current) return;
      if (!window.google?.accounts?.id) return;

      const shellEl = shellRef.current;
      const hostEl = hostRef.current;
      const fullW = Math.max(240, Math.floor(shellEl.getBoundingClientRect().width));
      // GIS clamp: 120–400. Render at 400 then scaleX to cover the form.
      const gisW = Math.min(400, fullW);
      const scale = fullW / gisW;

      hostEl.innerHTML = "";
      hostEl.style.width = `${gisW}px`;
      hostEl.style.transform = `scaleX(${scale})`;
      hostEl.style.transformOrigin = "left center";

      window.google.accounts.id.renderButton(hostEl, {
        type: "standard",
        theme: "outline",
        size: "large",
        text:
          text === "signup_with"
            ? "signup_with"
            : text === "signin_with"
              ? "signin_with"
              : "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: gisW,
      });
    }

    paint();
    const ro = new ResizeObserver(() => paint());
    ro.observe(shell);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [busy, gisStatus, clientId, text]);

  if (!clientId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Google Sign-In is not configured.
      </p>
    );
  }

  if (gisStatus === "error") {
    return (
      <div className="flex w-full flex-col gap-2 text-center">
        <p className="text-sm text-muted-foreground">
          Continue with Google unavailable. Use email instead.
        </p>
        <button
          type="button"
          className="text-sm font-medium text-primary underline underline-offset-2"
          onClick={() => retryGoogleGisReady()}
        >
          Try Google again
        </button>
      </div>
    );
  }

  if (busy) {
    return (
      <div
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[var(--color-border)] bg-white text-sm font-medium text-[#3c4043]"
        aria-busy="true"
      >
        <GoogleMark className="size-5 shrink-0" />
        {label}
      </div>
    );
  }

  const gisReady = gisStatus === "ready";

  return (
    <div className="w-full">
      <div
        ref={shellRef}
        className="relative mx-auto h-11 w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-white"
      >
        <div
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center gap-3 px-4"
          aria-hidden
        >
          <GoogleMark className="size-5 shrink-0" />
          <span className="text-sm font-medium text-[#3c4043]">{label}</span>
        </div>
        <div
          ref={hostRef}
          className={
            gisReady
              ? "absolute inset-y-0 left-0 z-10 opacity-0 [&_>div]:h-11 [&_iframe]:!h-11"
              : "pointer-events-none absolute inset-y-0 left-0 z-10 opacity-0"
          }
          aria-label={label}
        />
      </div>
    </div>
  );
}
