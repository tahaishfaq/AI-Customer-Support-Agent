import { NextResponse } from "next/server";
import axios from "axios";
import { requireAuth } from "@/lib/require-auth";
import { isSafepayConfigured } from "@/lib/billing/safepay-client";

function safepayHost() {
  const env = process.env.SAFEPAY_ENVIRONMENT?.trim() || "sandbox";
  if (env === "production") return "https://api.getsafepay.com";
  if (env === "development") return "https://dev.api.getsafepay.com";
  return "https://sandbox.api.getsafepay.com";
}

function merchantHeaders() {
  const secret = process.env.SAFEPAY_V1_SECRET.trim();
  return {
    "Content-Type": "application/json",
    "X-SFPY-MERCHANT-SECRET": secret,
    Authorization: `Bearer ${secret}`,
  };
}

/**
 * Phase 0 — after Atoms success: list wallet + try charge with payment_method.
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

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const customerToken = String(body.customerToken || "").trim();
    const paymentMethod = String(body.paymentMethod || "").trim();
    if (!customerToken || !paymentMethod) {
      return NextResponse.json(
        {
          error: {
            message: "customerToken and paymentMethod required",
            details: {},
          },
        },
        { status: 400 }
      );
    }

    const host = safepayHost();
    const headers = merchantHeaders();
    const probes = [];

    async function probe(label, method, path, data) {
      const res = await axios({
        method,
        url: `${host}${path}`,
        data,
        headers,
        validateStatus: () => true,
        timeout: 20000,
      });
      const entry = {
        label,
        method,
        path,
        status: res.status,
        ok: res.status >= 200 && res.status < 300,
        data: res.data,
      };
      probes.push(entry);
      return entry;
    }

    await probe(
      "customer_get",
      "GET",
      `/user/customers/v1/${encodeURIComponent(customerToken)}`
    );
    await probe(
      "wallet_list",
      "GET",
      `/user/customers/v1/${encodeURIComponent(customerToken)}/wallet/`
    );
    await probe(
      "wallet_find_pm",
      "GET",
      `/user/customers/v1/${encodeURIComponent(customerToken)}/wallet/${encodeURIComponent(paymentMethod)}`
    );

    const session = await probe("session_create", "POST", "/order/payments/v3/", {
      amount: 12500, // Rs 125 in paisa
      currency: "PKR",
      customer: customerToken,
    });
    const tracker = session.data?.data?.tracker?.token;

    let trackerAttach = null;
    if (tracker) {
      trackerAttach = await probe(
        "tracker_attach_pm",
        "POST",
        `/order/payments/v3/${encodeURIComponent(tracker)}`,
        { payment_method: paymentMethod }
      );
      await probe(
        "unscheduled_cof_session",
        "POST",
        "/order/payments/v3/",
        {
          amount: 12500,
          currency: "PKR",
          mode: "unscheduled_cof",
          customer: customerToken,
          payment_method: paymentMethod,
        }
      );
    }

    const wallet =
      probes.find((p) => p.label === "wallet_list")?.data?.data?.wallet || [];
    const walletHasPm = Array.isArray(wallet)
      ? wallet.some(
          (item) =>
            item?.token === paymentMethod ||
            item?.payment_method === paymentMethod ||
            item?.id === paymentMethod
        )
      : false;

    return NextResponse.json({
      ok: true,
      customerToken,
      paymentMethod,
      walletCount: Array.isArray(wallet) ? wallet.length : null,
      walletHasPm,
      tracker,
      trackerNextAction:
        trackerAttach?.data?.data?.tracker?.next_actions || null,
      probes: probes.map((p) => ({
        label: p.label,
        status: p.status,
        ok: p.ok,
        errors: p.data?.status?.errors || null,
        message: p.data?.status?.message || null,
        wallet: p.label === "wallet_list" ? p.data?.data : undefined,
        trackerState:
          p.label === "tracker_attach_pm" || p.label === "session_create"
            ? p.data?.data?.tracker?.state
            : undefined,
        nextActions:
          p.label === "tracker_attach_pm"
            ? p.data?.data?.tracker?.next_actions
            : undefined,
      })),
      note: "Phase 0 reuse probe — not production billing",
    });
  } catch (error) {
    console.error("POST /api/test/safepay-atoms-reuse", error);
    return NextResponse.json(
      { error: { message: "Reuse probe failed", details: {} } },
      { status: 500 }
    );
  }
}
