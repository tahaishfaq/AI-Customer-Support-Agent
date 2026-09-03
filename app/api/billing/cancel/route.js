import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { cancelUserSubscription } from "@/lib/billing/subscription.service";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        { error: { message: "Admins do not use billing cancel", details: {} } },
        { status: 400 }
      );
    }

    const limited = rateLimit(
      `billing:cancel:${authResult.user.id}:${clientIp(request)}`,
      { limit: 5, windowMs: 60_000 }
    );
    if (!limited.ok) {
      return tooManyRequests(limited, "Too many requests. Try again shortly.", request);
    }

    const subscription = await cancelUserSubscription(authResult.user.id, {
      ip: clientIp(request),
    });

    return NextResponse.json({ ok: true, subscription }, { status: 200 });
  } catch (error) {
    if (error.status === 400 || error.status === 502) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/billing/cancel", error);
    return NextResponse.json(
      { error: { message: "Unable to cancel subscription", details: {} } },
      { status: 500 }
    );
  }
}
