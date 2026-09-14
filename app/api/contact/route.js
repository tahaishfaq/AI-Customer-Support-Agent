import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { billingAdminEmails, EMAIL_TEMPLATES } from "@/lib/email/constants";
import { sendEmail } from "@/lib/email/send";

/**
 * Landing contact form — admin notify + submitter ack (E01 EM2).
 */

const contactSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(1).max(4000),
});

function contactIdempotencyKey(email, message) {
  const digest = createHash("sha256")
    .update(`${email.toLowerCase()}\n${message}`)
    .digest("hex")
    .slice(0, 24);
  const hour = new Date().toISOString().slice(0, 13);
  return `landing_contact:${digest}:${hour}`;
}

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

    const { fullName, email, company, message } = parsed.data;
    const admins = billingAdminEmails();
    const keyBase = contactIdempotencyKey(email, message);
    let queued = false;
    let providerError = null;

    if (admins.length === 0) {
      console.info("[contact] no BILLING_ADMIN_EMAIL configured", {
        emailDomain: email.split("@")[1] || null,
      });
      return NextResponse.json(
        {
          error: {
            message:
              "Contact inbox is not configured. Set BILLING_ADMIN_EMAIL.",
            details: { code: "CONTACT_INBOX_MISSING" },
          },
        },
        { status: 503 }
      );
    }

    for (const admin of admins) {
      try {
        const result = await sendEmail({
          template: EMAIL_TEMPLATES.LANDING_CONTACT_ADMIN,
          to: admin,
          data: { fullName, email, company, message },
          idempotencyKey: `${keyBase}:admin:${admin}`,
          tags: ["contact", "admin"],
        });
        if (result.ok) queued = true;
      } catch (error) {
        providerError = error;
        console.error("[contact] admin email failed", {
          code: error.code || null,
          message: error.cause?.message || error.message,
        });
      }
    }

    if (!queued) {
      const cause = String(
        providerError?.cause?.message || providerError?.message || ""
      );
      const domainIssue = /domain is not verified/i.test(cause);
      return NextResponse.json(
        {
          error: {
            message: domainIssue
              ? "Email sender domain is not verified in Resend. Update EMAIL_FROM to a verified domain (or beth.t@resend.dev for testing)."
              : "Unable to deliver your message right now. Try again shortly.",
            details: {
              code: domainIssue
                ? "EMAIL_DOMAIN_UNVERIFIED"
                : "EMAIL_PROVIDER_ERROR",
            },
          },
        },
        { status: 503 }
      );
    }

    try {
      await sendEmail({
        template: EMAIL_TEMPLATES.LANDING_CONTACT_ACK,
        to: email,
        data: { fullName },
        idempotencyKey: `${keyBase}:ack`,
        tags: ["contact", "ack"],
      });
    } catch {
      // Ack is best-effort; admin mail already queued.
    }

    return NextResponse.json(
      { ok: true, queued: true, deferred: false },
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
