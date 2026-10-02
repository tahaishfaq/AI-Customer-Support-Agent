/**
 * Level 2 · P8 — send support replies for EMAIL conversations via Resend.
 * Uses Auto-Submitted + threading headers. Not for product/auth templates.
 */

import {
  getResendClient,
  isEmailConfigured,
  isEmailTestMode,
} from "@/lib/email/client";
import { pushEmailSink } from "@/lib/email/test-sink";

/**
 * @param {{
 *   from: string,
 *   to: string,
 *   subject: string,
 *   text: string,
 *   inReplyTo?: string|null,
 *   references?: string[],
 *   conversationId?: string|null,
 * }} opts
 */
export async function sendSupportEmailReply(opts) {
  const to = String(opts.to || "").trim().toLowerCase();
  const from = String(opts.from || "").trim();
  const subject = String(opts.subject || "Re: Support").slice(0, 200);
  const text = String(opts.text || "").slice(0, 50_000);
  if (!to || !from || !text) {
    return { ok: false, reason: "missing_fields" };
  }

  const headers = {
    "Auto-Submitted": "auto-replied",
  };
  if (opts.inReplyTo) {
    headers["In-Reply-To"] = `<${opts.inReplyTo.replace(/^<|>$/g, "")}>`;
  }
  const refs = Array.isArray(opts.references) ? opts.references.filter(Boolean) : [];
  if (opts.inReplyTo && !refs.includes(opts.inReplyTo)) {
    refs.push(opts.inReplyTo);
  }
  if (refs.length) {
    headers.References = refs.map((id) => `<${String(id).replace(/^<|>$/g, "")}>`).join(" ");
  }

  if (isEmailTestMode() || !isEmailConfigured()) {
    pushEmailSink({
      template: "support_reply",
      to,
      from,
      subject,
      text,
      headers,
      conversationId: opts.conversationId || null,
      mock: true,
    });
    return { ok: true, mock: true };
  }

  const resend = getResendClient();
  if (!resend) {
    return { ok: false, reason: "not_configured" };
  }

  const result = await resend.emails.send({
    from,
    to: [to],
    subject,
    text,
    headers,
  });
  if (result.error) {
    return { ok: false, reason: result.error.message || "send_failed" };
  }
  return { ok: true, messageId: result.data?.id || null };
}
