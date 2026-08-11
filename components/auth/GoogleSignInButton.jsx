"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const SCRIPT_ID = "google-gsi-script";

export function GoogleSignInButton({
  onError,
  onSuccess,
  text = "continue_with",
}) {
  const { loginWithGoogle } = useAuth();
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  onErrorRef.current = onError;
  onSuccessRef.current = onSuccess;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    function render() {
      if (!window.google?.accounts?.id || !buttonRef.current) return;

      const width = Math.min(
        Math.floor(containerRef.current?.offsetWidth || 360),
        400
      );

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            onErrorRef.current?.("Google sign-in failed");
            return;
          }

          setBusy(true);
          try {
            await loginWithGoogle(response.credential);
            onSuccessRef.current?.();
          } catch (error) {
            onErrorRef.current?.(error.message || "Google sign-in failed");
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
      setReady(true);
    }

    if (window.google?.accounts?.id) {
      render();
      return;
    }

    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    script.addEventListener("load", render);
    return () => script.removeEventListener("load", render);
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
        className={`flex w-full justify-center ${busy ? "pointer-events-none opacity-60" : ""}`}
      />
      {!ready && (
        <p className="text-center text-sm text-[var(--color-muted)]">
          Loading Google…
        </p>
      )}
    </div>
  );
}
