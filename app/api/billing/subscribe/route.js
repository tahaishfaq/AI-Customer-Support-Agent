import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { activateFreePlan } from "@/lib/billing/subscription.service";
import {
  subscribeFreeSchema,
  zodErrorDetails,
} from "@/lib/validations/billing";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        { error: { message: "Admins do not use billing subscribe", details: {} } },
        { status: 400 }
      );
    }

    const limited = rateLimit(`billing:subscribe:${authResult.user.id}:${clientIp(request)}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(limited, "Too many requests. Try again shortly.", request);
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = subscribeFreeSchema.safeParse(body);
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

    const subscription = await activateFreePlan(
      authResult.user.id,
      parsed.data.planId
    );

    return NextResponse.json(
      {
        ok: true,
        subscription,
        redirectTo: "/dashboard",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error.status === 400 || error.status === 409) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/billing/subscribe", error);
    return NextResponse.json(
      { error: { message: "Unable to activate plan", details: {} } },
      { status: 500 }
    );
  }
}
