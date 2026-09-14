import prisma from "@/lib/prisma";
import {
  getEmailFrom,
  getEmailReplyTo,
  getResendClient,
  isEmailConfigured,
  isEmailTestMode,
} from "@/lib/email/client";
import { renderTemplate } from "@/lib/email/templates";
import {
  pushEmailSink,
  recipientDomainHash,
} from "@/lib/email/test-sink";

export class EmailSendError extends Error {
  constructor(message, { code = "EMAIL_SEND_FAILED", status = 503, cause } = {}) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

function truncateError(message) {
  return String(message || "send failed").slice(0, 500);
}

/**
 * Idempotent transactional send.
 * Same idempotencyKey that already SENT/SKIPPED → skip without calling Resend.
 */
export async function sendEmail({
  template,
  to,
  data = {},
  idempotencyKey = null,
  tags = [],
  userId = null,
  requireConfigured = false,
} = {}) {
  if (!template || !to) {
    throw new EmailSendError("template and to are required", {
      code: "EMAIL_INVALID",
      status: 400,
    });
  }

  const toEmail = String(to).trim().toLowerCase();
  if (!toEmail.includes("@")) {
    throw new EmailSendError("Invalid recipient", {
      code: "EMAIL_INVALID",
      status: 400,
    });
  }

  if (idempotencyKey) {
    const existing = await prisma.emailDeliveryLog.findUnique({
      where: { idempotencyKey },
    });
    if (
      existing &&
      (existing.status === "SENT" || existing.status === "SKIPPED")
    ) {
      return {
        ok: true,
        skipped: true,
        messageId: existing.providerMessageId || existing.id,
        deliveryId: existing.id,
      };
    }
  }

  const rendered = renderTemplate(template, data);
  let log;
  try {
    log = await prisma.emailDeliveryLog.create({
      data: {
        template,
        toEmail,
        userId: userId || null,
        status: "QUEUED",
        idempotencyKey: idempotencyKey || null,
        metadata: {
          tags: Array.isArray(tags) ? tags.slice(0, 8) : [],
          domainHash: recipientDomainHash(toEmail),
        },
      },
    });
  } catch (error) {
    // Concurrent duplicate key — treat as already sent/queued.
    if (idempotencyKey && error?.code === "P2002") {
      const existing = await prisma.emailDeliveryLog.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          skipped: true,
          messageId: existing.providerMessageId || existing.id,
          deliveryId: existing.id,
        };
      }
    }
    throw error;
  }

  const useMock =
    isEmailTestMode() || (!isEmailConfigured() && process.env.NODE_ENV !== "production");

  if (requireConfigured && !isEmailConfigured() && !isEmailTestMode()) {
    await prisma.emailDeliveryLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: truncateError("Resend not configured"),
      },
    });
    throw new EmailSendError("Email service unavailable", {
      code: "EMAIL_NOT_CONFIGURED",
      status: 503,
    });
  }

  if (useMock) {
    const messageId = `mock_${log.id}`;
    await prisma.emailDeliveryLog.update({
      where: { id: log.id },
      data: { status: "SENT", providerMessageId: messageId },
    });
    pushEmailSink({
      template,
      to: toEmail,
      subject: rendered.subject,
      data,
      messageId,
      deliveryId: log.id,
      idempotencyKey,
    });
    if (process.env.NODE_ENV !== "production" && !isEmailTestMode()) {
      console.info("[email] mock send", {
        template,
        domainHash: recipientDomainHash(toEmail),
        messageId,
      });
      if (template === "password_reset_otp" && data?.code) {
        console.info("[email] DEV password reset OTP (not for production):", data.code);
      }
    }
    return { ok: true, skipped: false, messageId, deliveryId: log.id, mock: true };
  }

  if (!isEmailConfigured()) {
    await prisma.emailDeliveryLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: truncateError("Resend not configured"),
      },
    });
    throw new EmailSendError("Email service unavailable", {
      code: "EMAIL_NOT_CONFIGURED",
      status: 503,
    });
  }

  const resend = getResendClient();
  try {
    const payload = {
      from: getEmailFrom(),
      to: [toEmail],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: (Array.isArray(tags) ? tags : [])
        .slice(0, 3)
        .map((name) => ({ name: String(name).slice(0, 40), value: "1" })),
    };
    const replyTo = getEmailReplyTo();
    if (replyTo) payload.replyTo = replyTo;
    if (idempotencyKey) {
      // Resend supports Idempotency-Key header via options in some SDK versions;
      // we primarily rely on EmailDeliveryLog unique key.
    }

    const result = await resend.emails.send(payload);
    if (result.error) {
      throw new Error(result.error.message || "Resend error");
    }
    const messageId = result.data?.id || `resend_${log.id}`;
    await prisma.emailDeliveryLog.update({
      where: { id: log.id },
      data: { status: "SENT", providerMessageId: messageId },
    });
    return { ok: true, skipped: false, messageId, deliveryId: log.id };
  } catch (error) {
    await prisma.emailDeliveryLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: truncateError(error.message || error),
      },
    });
    throw new EmailSendError("Failed to send email", {
      code: "EMAIL_PROVIDER_ERROR",
      status: 503,
      cause: error,
    });
  }
}
