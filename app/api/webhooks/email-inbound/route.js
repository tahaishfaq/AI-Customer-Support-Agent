import { NextResponse } from "next/server";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";
import { verifyResendInboundWebhook } from "@/lib/email/inbound-verify";
import { processResendInboundEvent } from "@/lib/services/email-inbound.service";

/**
 * Level 2 · P8 — Resend inbound (`email.received`).
 * Verify with RESEND_INBOUND_SECRET (Svix headers). Unknown recipient → 200 drop.
 */
export async function POST(request) {
  const requestId = resolveRequestId(request);
  try {
    const secret = process.env.RESEND_INBOUND_SECRET?.trim() || "";
    const rawBody = await request.text();
    const verified = verifyResendInboundWebhook(secret, rawBody, {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    });
    if (!verified.ok) {
      return NextResponse.json(
        { error: { message: "Invalid webhook signature", code: verified.reason } },
        { status: 401 }
      );
    }

    // Optional test hook: fixtures may embed body under data._aideFixture (never from Resend).
    const fixtureBody =
      verified.event?.data?._aideFixture &&
      process.env.EMAIL_TEST_MODE === "1"
        ? verified.event.data._aideFixture
        : null;

    const result = await processResendInboundEvent(verified.event, {
      requestId,
      fixtureBody,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    safeLogError("POST /api/webhooks/email-inbound", {
      code: error?.code || error?.status || "EMAIL_INBOUND_FAILED",
      requestId,
    });
    return NextResponse.json(
      { error: { message: "Unable to process inbound email" } },
      { status: 500 }
    );
  }
}
