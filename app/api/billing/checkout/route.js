import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { startPaidCheckout } from "@/lib/billing/checkout.service";
import { getRequestAppBaseUrl } from "@/lib/billing/app-url";
import {
  checkoutPaidSchema,
  zodErrorDetails,
} from "@/lib/validations/billing";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        { error: { message: "Admins do not use billing checkout", details: {} } },
        { status: 400 }
      );
    }

    const limited = rateLimit(
      `billing:checkout:${authResult.user.id}:${clientIp(request)}`,
      { limit: 10, windowMs: 60_000 }
    );
    if (!limited.ok) {
      return tooManyRequests(limited, "Too many requests. Try again shortly.", request);
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

    const result = await startPaidCheckout(authResult.user.id, parsed.data.planId, {
      ip: clientIp(request),
      appBaseUrl: getRequestAppBaseUrl(request),
    });

    return NextResponse.json(
      {
        ok: true,
        url: result.url,
        checkoutReference: result.checkoutReference,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error.status === 400 || error.status === 409 || error.status === 503 || error.status === 502) {
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
    console.error("POST /api/billing/checkout", error);
    return NextResponse.json(
      { error: { message: "Unable to start checkout", details: {} } },
      { status: 500 }
    );
  }
}
