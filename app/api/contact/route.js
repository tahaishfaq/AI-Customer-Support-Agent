import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Landing contact form — accepts submissions now; Resend email send is wired in E01 EM2.
 * See docs/features/EMAIL_RESEND_PLAN.md → landing_contact_admin / landing_contact_ack.
 */

const contactSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request) {
  try {
    const limited = rateLimit(`contact:${clientIp(request)}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many messages. Try again shortly.",
        request
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid contact details",
            details: {},
          },
        },
        { status: 400 }
      );
    }

    // TODO(E01-EM2): sendEmail({ template: 'landing_contact_admin', ... })
    // + optional ack to submitter (landing_contact_ack). Persist if needed.
    console.info("[contact] landing form received (email deferred to Resend EM2)", {
      emailDomain: parsed.data.email.split("@")[1] || null,
      company: Boolean(parsed.data.company),
      messageLen: parsed.data.message.length,
    });

    return NextResponse.json(
      { ok: true, queued: false, deferred: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/contact", error);
    return NextResponse.json(
      { error: { message: "Unable to send message", details: {} } },
      { status: 500 }
    );
  }
}
