import { NextResponse } from "next/server";
import { isSafepayConfigured } from "@/lib/billing/safepay-client";
import { processSafepayWebhook } from "@/lib/billing/webhook.service";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSafepayConfigured()) {
    return NextResponse.json(
      { error: { message: "Webhooks not configured", details: {} } },
      { status: 503 }
    );
  }

  try {
    const rawBody = await request.text();
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const result = await processSafepayWebhook({
      rawBody,
      headers,
      ip: clientIp(request),
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    if (error.status === 401) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 401 }
      );
    }
    if (error.status === 400) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 400 }
      );
    }
    console.error("POST /api/webhooks/safepay", error);
    return NextResponse.json(
      { error: { message: "Webhook processing failed", details: {} } },
      { status: 500 }
    );
  }
}
