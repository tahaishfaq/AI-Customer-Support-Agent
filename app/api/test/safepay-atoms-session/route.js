import { NextResponse } from "next/server";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";
import { getSafepayClient, isSafepayConfigured } from "@/lib/billing/safepay-client";

/**
 * Phase 0 only — isolated Atoms sandbox session.
 * Not wired to Subscription / live checkout.
 */
export async function POST(request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: { message: "Phase 0 POC disabled in production", details: {} } },
        { status: 404 }
      );
    }

    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    if (!isSafepayConfigured()) {
      return NextResponse.json(
        { error: { message: "SafePay is not configured", details: {} } },
        { status: 503 }
      );
    }

    const env = process.env.SAFEPAY_ENVIRONMENT?.trim() || "sandbox";
    const secret = process.env.SAFEPAY_V1_SECRET.trim();
    const host =
      env === "production"
        ? "https://api.getsafepay.com"
        : env === "development"
          ? "https://dev.api.getsafepay.com"
          : "https://sandbox.api.getsafepay.com";

    const headers = {
      "Content-Type": "application/json",
      "X-SFPY-MERCHANT-SECRET": secret,
      Authorization: `Bearer ${secret}`,
    };

    const email =
      authResult.user.email ||
      `phase0+${authResult.user.id.slice(0, 8)}@example.com`;
    const nameParts = String(authResult.user.name || "Phase Zero").split(/\s+/);
    const firstName = (nameParts[0] || "Phase").slice(0, 40);
    const lastName = (nameParts.slice(1).join(" ") || "Zero").slice(0, 40);

    const customerRes = await axios.post(
      `${host}/user/customers/v1/`,
      {
        first_name: firstName.length >= 2 ? firstName : "Phase",
        last_name: lastName.length >= 2 ? lastName : "Zero",
        email,
        phone_number: "+923001234567",
        country: "PK",
        is_guest: true,
      },
      { headers, validateStatus: () => true, timeout: 20000 }
    );

    const customerToken = customerRes.data?.data?.token;
    if (!customerToken) {
      return NextResponse.json(
        {
          error: {
            message: "Unable to create Safepay customer",
            details: customerRes.data?.status || {},
          },
        },
        { status: 502 }
      );
    }

    const { planPriceToSafepayAmount } = await import(
      "@/lib/billing/safepay-amount"
    );
    const amountWholePkr = 100; // POC display: Rs 100
    const amount = planPriceToSafepayAmount(amountWholePkr);
    const sessionRes = await axios.post(
      `${host}/order/payments/v3/`,
      { amount, currency: "PKR", customer: customerToken },
      { headers, validateStatus: () => true, timeout: 20000 }
    );

    const tracker = sessionRes.data?.data?.tracker;
    if (!tracker?.token) {
      return NextResponse.json(
        {
          error: {
            message: "Unable to create payment session",
            details: sessionRes.data?.status || {},
          },
        },
        { status: 502 }
      );
    }

    const authToken = await getSafepayClient().authorization.create();

    return NextResponse.json({
      ok: true,
      environment: env,
      amount: amountWholePkr,
      safepayAmount: amount,
      currency: "PKR",
      customerToken,
      tracker: tracker.token,
      authToken,
      mode: tracker.mode,
      entryMode: tracker.entry_mode,
      note: "Phase 0 POC — does not activate Subscription",
    });
  } catch (error) {
    console.error("POST /api/test/safepay-atoms-session", error);
    return NextResponse.json(
      { error: { message: "Phase 0 session failed", details: {} } },
      { status: 500 }
    );
  }
}
