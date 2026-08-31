"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";

const SCRIPT_ID = "google-gsi-script";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GIS_TIMEOUT_MS = 8000;

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

function waitForGis() {
  return new Promise((resolve, reject) => {
    if (gisReady()) {
      resolve();
      return;
    }

    const script = ensureGisScript();
    let settled = false;
    let pollId = 0;
    let timeoutId = 0;

    function done(ok) {
      if (settled) return;
      settled = true;
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (ok) resolve();
      else reject(new Error("Google Sign-In unavailable"));
    }

    function onLoad() {
      if (gisReady()) done(true);
    }

    function onError() {
      done(false);
    }

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    pollId = window.setInterval(() => {
      if (gisReady()) done(true);
    }, 50);

    timeoutId = window.setTimeout(() => done(false), GIS_TIMEOUT_MS);

    if (gisReady()) done(true);
  });
}

function GoogleMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function labelFor(text) {
  if (text === "signin_with") return "Sign in with Google";
  return "Continue with Google";
}

function isFedCmAbort(err) {
  if (!err) return false;
  const name = err.name || "";
  const message = String(err.message || err);
  return (
    name === "AbortError" ||
    message.includes("FedCM") ||
    message.includes("signal is aborted")
  );
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
  const loginRef = useRef(loginWithGoogle);
  const initializedRef = useRef(false);
  const [phase, setPhase] = useState("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;
    loginRef.current = loginWithGoogle;
  }, [onError, onSuccess, loginWithGoogle]);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  function ensureInitialized() {
    if (initializedRef.current || !clientId) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!response.credential) {
          onErrorRef.current?.("Google sign-in failed");
          return;
        }
        setBusy(true);
        try {
          const user = await loginRef.current(response.credential);
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
      cancel_on_tap_outside: true,
      // Avoid FedCM One Tap in privacy browsers / Incognito (AbortError noise).
      use_fedcm_for_prompt: false,
      auto_select: false,
    });
    initializedRef.current = true;
  }

  function paintOfficialButton() {
    if (!buttonRef.current || !containerRef.current) return;

    const width = Math.min(
      Math.floor(containerRef.current.offsetWidth || 360),
      400
    );
    if (width < 40) return;

    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text,
      shape: "rectangular",
      logo_alignment: "left",
      width,
    });
    setPhase("ready");
  }

  async function startGoogleSignIn() {
    if (!clientId || phase === "loading" || busy) return;

    setPhase("loading");
    try {
      await waitForGis();
      ensureInitialized();
      // Skip One Tap prompt — FedCM aborts in Incognito and logs console errors.
      // Official button click still works for the OAuth flow.
      paintOfficialButton();
    } catch (err) {
      if (isFedCmAbort(err)) {
        try {
          paintOfficialButton();
          return;
        } catch {
          /* fall through */
        }
      }
      setPhase("error");
      onErrorRef.current?.(
        "Continue with Google unavailable. Use email instead."
      );
    }
  }

  if (!clientId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Google Sign-In is not configured.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="w-full min-h-10">
      {phase === "idle" || phase === "loading" ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full gap-2 border-border bg-card text-sm font-medium text-foreground hover:bg-muted"
          disabled={phase === "loading" || busy}
          onClick={startGoogleSignIn}
        >
          {phase === "loading" ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <GoogleMark className="size-4" />
          )}
          {phase === "loading" ? "Connecting…" : labelFor(text)}
        </Button>
      ) : null}

      <div
        ref={buttonRef}
        className={`flex min-h-10 w-full justify-center ${
          phase === "ready" ? "" : "hidden"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
        aria-busy={busy}
      />

      {phase === "error" ? (
        <div className="flex flex-col gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            Continue with Google unavailable. Use email instead.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setPhase("idle")}
          >
            Try Google again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
