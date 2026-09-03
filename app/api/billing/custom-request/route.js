import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { createCustomPlanRequest } from "@/lib/billing/custom-request.service";
import {
  customPlanRequestSchema,
  zodErrorDetails,
} from "@/lib/validations/billing";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const limited = rateLimit(
      `billing:custom:${authResult.user.id}:${clientIp(request)}`,
      { limit: 6, windowMs: 60_000 }
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

    const parsed = customPlanRequestSchema.safeParse(body);
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

    const row = await createCustomPlanRequest(authResult.user.id, parsed.data);
    return NextResponse.json(
      {
        ok: true,
        requestId: row.id,
        request: row,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.status === 429) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 429 }
      );
    }
    if (error.status === 400) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 400 }
      );
    }
    console.error("POST /api/billing/custom-request", error);
    return NextResponse.json(
      { error: { message: "Unable to submit request", details: {} } },
      { status: 500 }
    );
  }
}
