import { NextResponse } from "next/server";
import { createRestoreRequest } from "@/lib/services/restore-request.service";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const limited = rateLimit(`restore-request:${clientIp(request)}`, {
      limit: 8,
      windowMs: 15 * 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(limited, "Too many requests. Try again later.");
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Invalid JSON body", details: {} } },
        { status: 400 }
      );
    }

    const result = await createRestoreRequest({
      email: body?.email,
      message: body?.message,
    });
    return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
  } catch (error) {
    if (error.status === 400) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 400 }
      );
    }
    console.error("POST /api/auth/restore-request", error);
    return NextResponse.json(
      { error: { message: "Unable to send request", details: {} } },
      { status: 500 }
    );
  }
}
