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

/**
 * Google sign-in via GIS button (id-token → Auth.js google-id-token).
 * No /api/auth/providers round-trip, no One Tap prompt, no /login bounce.
 */
export function GoogleSignInButton({
  onError,
  onSuccess,
  text = "continue_with",
}) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const gisStatus = useGoogleGisStatus();
  const hostRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  const loginRef = useRef(loginWithGoogle);
  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;
  loginRef.current = loginWithGoogle;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

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
      // Keep busy=true on success until navigation unmounts — avoids overlapping labels.
    };
    return () => {
      gisCredentialHandler.current = null;
    };
  }, []);

  useEffect(() => {
    if (busy || gisStatus !== "ready" || !clientId) return;
    const host = hostRef.current;
    if (!host || !window.google?.accounts?.id) return;
    if (!ensureGisInitialized(clientId)) return;

    host.innerHTML = "";
    const width = Math.max(
      240,
      Math.floor(host.getBoundingClientRect().width) || 320
    );

    window.google.accounts.id.renderButton(host, {
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
      width,
    });
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
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-white text-sm font-medium text-muted-foreground"
        aria-busy="true"
      >
        Connecting…
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={hostRef}
        className="flex min-h-11 w-full justify-center overflow-hidden [& iframe]:!w-full"
      />
      {gisStatus === "loading" || gisStatus === "idle" ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Loading Google…
        </p>
      ) : null}
    </div>
  );
}
