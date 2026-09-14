import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";
import { confirmAtomsPayment } from "@/lib/billing/atoms-checkout.service";
import { isAtomsCheckoutEnabled } from "@/lib/billing/checkout-mode";
import { zodErrorDetails } from "@/lib/validations/billing";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const confirmSchema = z.object({
  attemptId: z.string().trim().min(1),
  paymentMethod: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^pm_[A-Za-z0-9_-]+$/i)
    .optional()
    .nullable(),
});

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
      `billing:confirm:${authResult.user.id}:${clientIp(request)}`,
      { limit: 20, windowMs: 60_000 }
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

    const parsed = confirmSchema.safeParse(body);
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

    const result = await confirmAtomsPayment(
      authResult.user.id,
      {
        attemptId: parsed.data.attemptId,
        paymentMethod: parsed.data.paymentMethod || null,
      },
      { ip: clientIp(request) }
    );

    return NextResponse.json(
      {
        ok: true,
        already: result.already,
        subscription: result.subscription,
      },
      { status: 200 }
    );
  } catch (error) {
    if (
      error.status === 404 ||
      error.status === 409 ||
      error.status === 410 ||
      error.status === 400
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
    console.error("POST /api/billing/confirm-atoms", error);
    return NextResponse.json(
      { error: { message: "Unable to confirm payment", details: {} } },
      { status: 500 }
    );
  }
}
