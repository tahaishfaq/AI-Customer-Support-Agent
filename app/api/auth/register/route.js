import { NextResponse } from "next/server";
import { registerUser } from "@/lib/services/auth.service";
import { registerSchema, zodErrorDetails } from "@/lib/validations/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const limited = rateLimit(`register:${clientIp(request)}`, {
      limit: 8,
      windowMs: 15 * 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many accounts created from this network. Try again later."
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: zodErrorDetails(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const result = await registerUser(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error.status === 409) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 409 }
      );
    }
    if (error.status === 403) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 403 }
      );
    }
    console.error("POST /api/auth/register", error);
    return NextResponse.json(
      { error: { message: "Unable to register", details: {} } },
      { status: 500 }
    );
  }
}
