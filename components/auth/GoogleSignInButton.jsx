"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

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
  const [phase, setPhase] = useState("loading");
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
      use_fedcm_for_prompt: false,
      auto_select: false,
    });
    initializedRef.current = true;
  }

  function paintOfficialButton() {
    if (!buttonRef.current || !containerRef.current) return false;

    const width = Math.min(
      Math.floor(containerRef.current.offsetWidth || 360),
      400
    );
    if (width < 40) return false;

    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text,
      shape: "rectangular",
      logo_alignment: "left",
      width,
    });
    return true;
  }

  useEffect(() => {
    if (!clientId) return undefined;

    let cancelled = false;

    async function prepare() {
      try {
        await waitForGis();
        if (cancelled) return;
        ensureInitialized();

        // Wait for layout so the container has a real width.
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        if (cancelled) return;

        if (paintOfficialButton()) {
          setPhase("ready");
          return;
        }

        // Fallback if width not ready yet.
        const observer = new ResizeObserver(() => {
          if (cancelled) return;
          if (paintOfficialButton()) {
            setPhase("ready");
            observer.disconnect();
          }
        });
        if (containerRef.current) observer.observe(containerRef.current);

        window.setTimeout(() => {
          if (cancelled) return;
          if (paintOfficialButton()) setPhase("ready");
          else setPhase("error");
          observer.disconnect();
        }, 500);
      } catch {
        if (!cancelled) setPhase("error");
      }
    }

    prepare();

    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Google Sign-In is not configured.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full min-h-10">
      {phase === "loading" ? (
        <div
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-card text-sm text-muted-foreground"
          aria-hidden
        >
          <Loader2 className="size-4 animate-spin" />
          Loading Google…
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="flex flex-col gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            Continue with Google unavailable. Use email instead.
          </p>
          <button
            type="button"
            className="text-sm font-medium text-primary underline underline-offset-2"
            onClick={() => {
              setPhase("loading");
              waitForGis()
                .then(() => {
                  ensureInitialized();
                  if (paintOfficialButton()) setPhase("ready");
                  else setPhase("error");
                })
                .catch(() => setPhase("error"));
            }}
          >
            Try Google again
          </button>
        </div>
      ) : null}

      <div
        ref={buttonRef}
        className={`flex min-h-10 w-full justify-center ${
          phase === "ready" ? "" : "sr-only"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
        aria-busy={busy}
        aria-label="Sign in with Google"
      />
    </div>
  );
}
