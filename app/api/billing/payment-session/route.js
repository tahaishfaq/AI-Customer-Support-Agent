import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { createAtomsPaymentSession } from "@/lib/billing/atoms-checkout.service";
import { isAtomsCheckoutEnabled } from "@/lib/billing/checkout-mode";
import {
  checkoutPaidSchema,
  zodErrorDetails,
} from "@/lib/validations/billing";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    if (!isAtomsCheckoutEnabled()) {
      return NextResponse.json(
        {
          error: {
            message: "Atoms checkout is not enabled",
            details: { code: "checkout_mode_legacy" },
          },
        },
        { status: 400 }
      );
    }

    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        { error: { message: "Admins do not use billing checkout", details: {} } },
        { status: 400 }
      );
    }

    const limited = rateLimit(
      `billing:payment-session:${authResult.user.id}:${clientIp(request)}`,
      { limit: 10, windowMs: 60_000 }
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many requests. Try again shortly.",
        request
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = checkoutPaidSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid request",
            details: zodErrorDetails(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const result = await createAtomsPaymentSession(
      authResult.user.id,
      parsed.data.planId,
      {
        userEmail: authResult.user.email,
        userName: authResult.user.name,
        ip: clientIp(request),
      }
    );

    return NextResponse.json(
      {
        ok: true,
        attemptId: result.attemptId,
        checkoutReference: result.checkoutReference,
        tracker: result.tracker,
        authToken: result.authToken,
        environment: result.environment,
        amount: result.amount,
        currency: result.currency,
        planName: result.planName,
        customerToken: result.customerToken,
      },
      { status: 200 }
    );
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 409 ||
      error.status === 503 ||
      error.status === 502
    ) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            details: error.details || { code: error.code },
          },
        },
        { status: error.status }
      );
    }
    console.error("POST /api/billing/payment-session", error);
    return NextResponse.json(
      { error: { message: "Unable to start payment session", details: {} } },
      { status: 500 }
    );
  }
}
