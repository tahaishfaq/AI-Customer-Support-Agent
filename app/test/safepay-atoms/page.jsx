"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { CardCapture, PayerAuthentication } from "@sfpy/atoms";
import "@sfpy/atoms/styles";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/** Safepay dummy-card billing (helps.co docs) — required by Atoms PayerAuthentication demos. */
const BILLING = {
  street_1: "Building 3, Apartment 5, 10th commercial lane, Zamzama",
  city: "Karachi",
  state: "SD",
  country: "PK",
  postal_code: "75500",
};

/**
 * Phase 0 isolated Atoms demo — not production billing.
 */
export default function SafepayAtomsPhase0Page() {
  const cardRef = useRef(null);
  const authRef = useRef(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [log, setLog] = useState([]);
  const logId = useRef(0);
  const [payerAuthSession, setPayerAuthSession] = useState(null);
  const [discountBody, setDiscountBody] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [savedPm, setSavedPm] = useState("");
  const [reuseBusy, setReuseBusy] = useState(false);

  function push(msg) {
    logId.current += 1;
    const id = logId.current;
    const line = `${new Date().toISOString().slice(11, 19)} ${msg}`;
    setLog((prev) => [{ id, line }, ...prev].slice(0, 40));
  }

  const closeAuth = useCallback(() => {
    setPayerAuthSession(null);
  }, []);

  async function startSession() {
    setBusy(true);
    setError("");
    setSession(null);
    setPayerAuthSession(null);
    setDiscountBody(undefined);
    setSavedPm("");
    try {
      const data = await apiFetch("/api/test/safepay-atoms-session", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSession(data);
      push(`session ok tracker=${data.tracker} customer=${data.customerToken}`);
    } catch (err) {
      setError(err.message || "Session failed");
      push(`session error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifyReuse(paymentMethod) {
    if (!session?.customerToken || !paymentMethod) {
      push("reuse skipped — missing customer or payment_method");
      return;
    }
    setReuseBusy(true);
    try {
      const data = await apiFetch("/api/test/safepay-atoms-reuse", {
        method: "POST",
        body: JSON.stringify({
          customerToken: session.customerToken,
          paymentMethod,
        }),
      });
      push(
        `reuse walletCount=${data.walletCount} walletHasPm=${data.walletHasPm}`
      );
      for (const p of data.probes || []) {
        push(
          `probe ${p.label} → ${p.status}${p.errors?.length ? ` ${p.errors.join(";")}` : ""}`
        );
      }
      if (data.trackerNextAction) {
        push(`tracker next ${JSON.stringify(data.trackerNextAction).slice(0, 160)}`);
      }
    } catch (err) {
      push(`reuse error: ${err.message}`);
      setError(err.message || "Reuse probe failed");
    } finally {
      setReuseBusy(false);
    }
  }

  async function onPay() {
    if (!cardRef.current) return;
    cardRef.current.validate();
    const valid = await cardRef.current.fetchValidity();
    if (!valid) {
      push("card invalid");
      return;
    }
    push("submitting card…");
    cardRef.current.submit();
  }

  if (process.env.NODE_ENV === "production") {
    return (
      <main className="mx-auto max-w-lg p-8">
        <p>Phase 0 POC is disabled in production.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-[#F5F3F0] px-4 py-10 text-[#1A1814]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">
          Phase 0 · Sandbox only
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Safepay Atoms POC</h1>
        <p className="mt-2 text-sm text-[#6B665C]">
          Does not activate AIDE subscriptions. Use dummy card{" "}
          <span className="font-mono">5200…1096 / 03/28 / 111</span>. Blue
          spinner = 3DS setup; success log must show{" "}
          <span className="font-mono">frictionless</span> or{" "}
          <span className="font-mono">3DS success</span>.
        </p>
      </div>

      <Button type="button" disabled={busy} onClick={startSession}>
        {busy ? "Creating session…" : "Create payment session"}
      </Button>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {session ? (
        <div className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5">
          <div className="text-sm">
            <p className="font-medium">POC charge</p>
            <p className="text-[#6B665C]">
              {session.currency} {session.amount} · mode={session.mode}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-[#6B665C]">
              {session.tracker}
            </p>
          </div>

          <Suspense fallback={<p className="text-sm">Loading card fields…</p>}>
            <div className="min-h-[3rem]">
              <CardCapture
                environment={session.environment}
                authToken={session.authToken}
                tracker={session.tracker}
                validationEvent="submit"
                imperativeRef={cardRef}
                onReady={() => push("card ready")}
                onValidated={(d) =>
                  push(`validated bin=${d?.bin} last4=${d?.lastFour}`)
                }
                onDiscountApplied={(data) => {
                  if (data?.discountBody) setDiscountBody(data.discountBody);
                }}
                onProceedToAuthentication={(data) => {
                  push(
                    `proceed keys=${Object.keys(data || {}).join(",") || "none"}`
                  );
                  setPayerAuthSession({
                    accessToken: data?.accessToken || "",
                    deviceDataCollectionURL:
                      data?.deviceDataCollectionURL || "",
                  });
                }}
                onError={(e) => {
                  push(`card error: ${e}`);
                  setError(String(e));
                }}
              />
            </div>
          </Suspense>

          <Button type="button" className="w-full" onClick={onPay}>
            Pay (Atoms)
          </Button>

          {savedPm ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={reuseBusy}
              onClick={() => verifyReuse(savedPm)}
            >
              {reuseBusy ? "Checking reuse…" : "Verify card-on-file reuse"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {payerAuthSession && session ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeAuth}
        >
          <div
            className="h-[75vh] w-full max-w-xl overflow-hidden rounded-xl bg-white p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Suspense fallback={<p className="p-4 text-sm">Loading 3DS…</p>}>
              <PayerAuthentication
                environment={session.environment}
                tracker={session.tracker}
                authToken={session.authToken}
                user={session.customerToken || undefined}
                deviceDataCollectionJWT={payerAuthSession.accessToken}
                deviceDataCollectionURL={
                  payerAuthSession.deviceDataCollectionURL
                }
                billing={BILLING}
                discountBody={discountBody}
                authorizationOptions={{
                  do_capture: true,
                  do_card_on_file: true,
                }}
                imperativeRef={authRef}
                onPayerAuthenticationRequired={() => push("3DS challenge required")}
                onPayerAuthenticationFrictionless={(d) => {
                  const pm = d?.payment_method || "";
                  if (pm) setSavedPm(pm);
                  push(`frictionless ok ${JSON.stringify(d)?.slice(0, 180)}`);
                  closeAuth();
                  if (pm) void verifyReuse(pm);
                }}
                onPayerAuthenticationSuccess={(d) => {
                  const pm = d?.payment_method || "";
                  if (pm) setSavedPm(pm);
                  push(
                    `3DS success payment_method=${pm || "?"} auth=${d?.authorization || "?"}`
                  );
                  closeAuth();
                  if (pm) void verifyReuse(pm);
                }}
                onPayerAuthenticationFailure={(d) => {
                  push(`3DS failure ${JSON.stringify(d)?.slice(0, 180)}`);
                  setError(d?.error || "3DS failed");
                  closeAuth();
                }}
                onPayerAuthenticationUnavailable={(d) => {
                  push(
                    `auth unavailable ${JSON.stringify(d)?.slice(0, 220)}`
                  );
                  setError(
                    "Auth unavailable — Safepay could not complete enrollment. Try a fresh session."
                  );
                  closeAuth();
                }}
                onSafepayError={(e) => {
                  push(`safepay error ${JSON.stringify(e)?.slice(0, 220)}`);
                  setError(e?.error?.message || "Safepay error");
                  closeAuth();
                }}
              />
            </Suspense>
          </div>
        </div>
      ) : null}

      <ul className="space-y-1 font-mono text-[11px] text-[#6B665C]">
        {log.map((entry) => (
          <li key={entry.id}>{entry.line}</li>
        ))}
      </ul>
    </main>
  );
}
