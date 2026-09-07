"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CardCapture, PayerAuthentication } from "@sfpy/atoms";
import "@sfpy/atoms/styles";
import { toast } from "sonner";
import { confirmAtomsPayment } from "@/lib/api/billing";
import { refreshConversationQuota } from "@/hooks/use-conversation-quota";
import { Button } from "@/components/ui/button";

/** Default PK billing for PayerAuthentication (required by Safepay Atoms). */
const DEFAULT_BILLING = {
  street_1: "Building 3, Apartment 5, 10th commercial lane, Zamzama",
  city: "Karachi",
  state: "SD",
  country: "PK",
  postal_code: "75500",
};

/**
 * Production Atoms checkout UI — used by /billing/pay.
 */
export function AtomsCheckoutForm({ session }) {
  const router = useRouter();
  const cardRef = useRef(null);
  const authRef = useRef(null);
  const [error, setError] = useState("");
  const [payerAuthSession, setPayerAuthSession] = useState(null);
  const [discountBody, setDiscountBody] = useState(undefined);
  const [confirming, setConfirming] = useState(false);
  const confirmedRef = useRef(false);

  const closeAuth = useCallback(() => {
    setPayerAuthSession(null);
  }, []);

  async function finalize(paymentMethod) {
    if (confirmedRef.current || confirming) return;
    confirmedRef.current = true;
    setConfirming(true);
    try {
      await confirmAtomsPayment({
        attemptId: session.attemptId,
        paymentMethod: paymentMethod || null,
      });
      toast.success("Payment successful — plan activated");
      refreshConversationQuota();
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      confirmedRef.current = false;
      setError(err.message || "Unable to activate plan after payment");
      toast.error(err.message || "Unable to activate plan");
    } finally {
      setConfirming(false);
    }
  }

  async function onPay() {
    if (!cardRef.current || confirming) return;
    setError("");
    cardRef.current.validate();
    const valid = await cardRef.current.fetchValidity();
    if (!valid) {
      setError("Check your card details and try again.");
      return;
    }
    cardRef.current.submit();
  }

  if (!session?.tracker || !session?.authToken) {
    return (
      <p className="text-sm text-muted-foreground">
        Payment session is incomplete. Go back and choose a plan again.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">
          {session.planName || "Paid plan"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.currency} {Number(session.amount).toLocaleString()} · card
          payment via SafePay
        </p>

        <Suspense fallback={<p className="mt-4 text-sm">Loading card fields…</p>}>
          <div className="mt-4 min-h-[3rem]">
            <CardCapture
              environment={session.environment}
              authToken={session.authToken}
              tracker={session.tracker}
              validationEvent="submit"
              imperativeRef={cardRef}
              onDiscountApplied={(data) => {
                if (data?.discountBody) setDiscountBody(data.discountBody);
              }}
              onProceedToAuthentication={(data) => {
                setPayerAuthSession({
                  accessToken: data?.accessToken || "",
                  deviceDataCollectionURL:
                    data?.deviceDataCollectionURL || "",
                });
              }}
              onError={(e) => setError(String(e))}
            />
          </div>
        </Suspense>

        {error ? (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          className="mt-4 w-full"
          disabled={confirming}
          onClick={onPay}
        >
          {confirming ? "Activating…" : "Pay securely"}
        </Button>
      </div>

      {payerAuthSession ? (
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
                billing={DEFAULT_BILLING}
                discountBody={discountBody}
                authorizationOptions={{
                  do_capture: true,
                  do_card_on_file: true,
                }}
                imperativeRef={authRef}
                onPayerAuthenticationFrictionless={(d) => {
                  closeAuth();
                  void finalize(d?.payment_method || null);
                }}
                onPayerAuthenticationSuccess={(d) => {
                  closeAuth();
                  void finalize(d?.payment_method || null);
                }}
                onPayerAuthenticationFailure={(d) => {
                  setError(d?.error || "Authentication failed");
                  closeAuth();
                }}
                onPayerAuthenticationUnavailable={() => {
                  setError(
                    "Card authentication unavailable. Try again with a fresh session."
                  );
                  closeAuth();
                }}
                onSafepayError={(e) => {
                  setError(e?.error?.message || "Payment error");
                  closeAuth();
                }}
              />
            </Suspense>
          </div>
        </div>
      ) : null}
    </div>
  );
}
