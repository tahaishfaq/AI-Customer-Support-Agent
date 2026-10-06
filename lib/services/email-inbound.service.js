/**
 * Level 2 · P8 — process a verified Resend `email.received` event into an EMAIL conversation.
 * Sender is an unverified guest (no customerSubject JWT / no private tools).
 */

import prisma from "@/lib/prisma";
import { getResendClient, isEmailConfigured } from "@/lib/email/client";
import {
  cleanMessageId,
  emailGuestSubject,
  extractEmailAddress,
  extractInboundBody,
  parseThreadHints,
  shouldIgnoreInbound,
} from "@/lib/email/inbound-parse";
import { sendSupportEmailReply } from "@/lib/email/support-reply";
import { sendChatMessage } from "@/lib/services/chat.service";
import { safeLogError } from "@/lib/observability/safe-log";
import { rateLimit } from "@/lib/rate-limit";

const FROM_NAME_DEFAULT = "Support";

/**
 * @param {object} event verified Resend webhook JSON
 * @param {{ requestId?: string|null, fixtureBody?: object|null }} [opts]
 *   fixtureBody: test-only full email content when Receiving API is unavailable
 */
export async function processResendInboundEvent(event, opts = {}) {
  if (!event || event.type !== "email.received") {
    return { handled: false, reason: "ignored_type" };
  }

  const data = event.data || {};
  const emailId = String(data.email_id || data.id || "").trim();
  const toList = Array.isArray(data.to) ? data.to : [data.to].filter(Boolean);
  const toAddress = extractEmailAddress(toList[0]) || extractEmailAddress(data.to);
  const fromAddress = extractEmailAddress(data.from);
  const subject = String(data.subject || "").slice(0, 300);

  if (!toAddress) {
    return { handled: true, reason: "unknown_recipient" };
  }

  const agent = await prisma.agent.findFirst({
    where: {
      emailChannelAddress: toAddress,
      enabled: true,
    },
  });
  if (!agent) {
    return { handled: true, reason: "unknown_recipient" };
  }

  const channel = readEmailChannel(agent);
  if (!channel.enabled) {
    return { handled: true, reason: "channel_disabled" };
  }

  const content = await loadReceivedEmailContent(emailId, opts.fixtureBody);
  const headers = content.headers || data.headers || {};
  const loop = shouldIgnoreInbound(headers, {
    from: data.from || fromAddress,
    subject,
    ownAddresses: [toAddress, agent.emailChannelAddress].filter(Boolean),
  });
  if (loop.ignore) {
    return { handled: true, reason: loop.reason };
  }

  const messageId =
    cleanMessageId(headers["message-id"] || headers["Message-ID"]) ||
    emailId ||
    null;
  if (!messageId) {
    return { handled: true, reason: "missing_message_id" };
  }

  const existing = await prisma.inboundEmail.findUnique({
    where: { messageId },
    select: { id: true, conversationId: true },
  });
  if (existing) {
    return {
      handled: true,
      reason: "duplicate",
      conversationId: existing.conversationId,
    };
  }

  const senderKey = fromAddress || "unknown";
  const limitedSender = await rateLimit(`email-in:from:${senderKey}`, {
    limit: 10,
    windowMs: 60_000,
  });
  const limitedAgent = await rateLimit(`email-in:agent:${agent.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limitedSender.ok || !limitedAgent.ok) {
    return { handled: true, reason: "rate_limited" };
  }

  const { text, truncated } = extractInboundBody({
    text: content.text,
    html: content.html,
  });
  const hasAttachments =
    Boolean(content.hasAttachments) ||
    (Array.isArray(data.attachments) && data.attachments.length > 0);

  let body = text;
  if (!body.trim()) {
    body = "(Empty message body.)";
  }
  if (hasAttachments) {
    body += "\n\n(Note: attachments were ignored.)";
  }
  if (truncated) {
    body += "\n\n(Note: message was truncated.)";
  }

  const hints = parseThreadHints(headers, subject);
  let conversationId = await findThreadConversation(agent.id, hints);

  // Record idempotency before the slow chat turn (unique Message-ID).
  try {
    await prisma.inboundEmail.create({
      data: {
        messageId,
        agentId: agent.id,
        conversationId: conversationId || null,
        fromAddress: fromAddress || null,
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      const again = await prisma.inboundEmail.findUnique({
        where: { messageId },
        select: { conversationId: true },
      });
      return {
        handled: true,
        reason: "duplicate",
        conversationId: again?.conversationId || null,
      };
    }
    throw error;
  }

  let result;
  try {
    result = await sendChatMessage(agent.id, {
      emailChannel: true,
      publicAccess: true,
      conversationSource: "EMAIL",
      message: body,
      conversationId: conversationId || undefined,
      customerSubject: emailGuestSubject(fromAddress),
      emailMeta: {
        fromAddress,
        subject,
        messageId,
        threadToken: hints.threadToken,
      },
      requestId: opts.requestId || null,
    });
  } catch (error) {
    safeLogError("email inbound chat failed", {
      code: error?.code || error?.status || "EMAIL_CHAT_FAILED",
      agentId: agent.id,
    });
    // Keep InboundEmail row so we do not double-reply on provider retries.
    return {
      handled: true,
      reason: "chat_failed",
      errorCode: error?.code || "CHAT_FAILED",
    };
  }

  conversationId = result.conversationId || conversationId;
  if (conversationId) {
    await prisma.inboundEmail.update({
      where: { messageId },
      data: { conversationId },
    });
  }

  const replyText = String(
    result?.message?.content || result?.assistantMessage?.content || ""
  ).trim();
  if (replyText && fromAddress) {
    const fromHeader = formatFromHeader(channel.fromName, toAddress);
    const replySubject = subject.startsWith("Re:")
      ? subject
      : `Re: ${subject || "your message"}`;
    const withToken = conversationId
      ? `${replySubject} [aide:${conversationId.slice(0, 24)}]`
      : replySubject;
    await sendSupportEmailReply({
      from: fromHeader,
      to: fromAddress,
      subject: withToken.slice(0, 200),
      text: replyText,
      inReplyTo: messageId,
      references: hints.references,
      conversationId,
    });
  }

  return {
    handled: true,
    reason: "ok",
    conversationId,
    agentId: agent.id,
  };
}

function readEmailChannel(agent) {
  const raw =
    agent?.emailChannel && typeof agent.emailChannel === "object"
      ? agent.emailChannel
      : {};
  return {
    enabled: raw.enabled !== false && Boolean(agent.emailChannelAddress),
    fromName: String(raw.fromName || FROM_NAME_DEFAULT).slice(0, 80),
  };
}

function formatFromHeader(fromName, address) {
  const name = String(fromName || FROM_NAME_DEFAULT).replace(/[<>\r\n]/g, "").trim();
  return `${name} <${address}>`;
}

async function loadReceivedEmailContent(emailId, fixtureBody) {
  if (fixtureBody && typeof fixtureBody === "object") {
    return {
      text: fixtureBody.text || null,
      html: fixtureBody.html || null,
      headers: fixtureBody.headers || {},
      hasAttachments: Boolean(fixtureBody.hasAttachments),
    };
  }
  if (!emailId || !isEmailConfigured()) {
    return { text: null, html: null, headers: {}, hasAttachments: false };
  }
  const resend = getResendClient();
  if (!resend?.emails?.receiving?.get) {
    return { text: null, html: null, headers: {}, hasAttachments: false };
  }
  try {
    const { data, error } = await resend.emails.receiving.get(emailId);
    if (error || !data) {
      safeLogError("email receiving get failed", {
        code: error?.name || "RECEIVING_GET_FAILED",
      });
      return { text: null, html: null, headers: {}, hasAttachments: false };
    }
    return {
      text: data.text || null,
      html: data.html || null,
      headers: data.headers || {},
      hasAttachments: Array.isArray(data.attachments)
        ? data.attachments.length > 0
        : Boolean(data.attachments),
    };
  } catch (error) {
    safeLogError("email receiving get threw", {
      code: error?.message || "RECEIVING_GET_THREW",
    });
    return { text: null, html: null, headers: {}, hasAttachments: false };
  }
}

async function findThreadConversation(agentId, hints) {
  if (hints.threadToken) {
    const byId = await prisma.conversation.findFirst({
      where: {
        id: { startsWith: hints.threadToken },
        agentId,
        source: "EMAIL",
      },
      select: { id: true },
    });
    if (byId) return byId.id;
    const exact = await prisma.conversation.findFirst({
      where: { id: hints.threadToken, agentId, source: "EMAIL" },
      select: { id: true },
    });
    if (exact) return exact.id;
  }

  const ids = [hints.inReplyTo, ...(hints.references || [])].filter(Boolean);
  if (!ids.length) return null;
  const hit = await prisma.inboundEmail.findFirst({
    where: { messageId: { in: ids }, agentId, conversationId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { conversationId: true },
  });
  return hit?.conversationId || null;
}

/**
 * Owner sets inbound address for an agent (same workspace uniqueness via @unique).
 */
export async function setAgentEmailChannel(agentId, userId, input = {}) {
  const { getAgentForUser } = await import("@/lib/services/agent.service");
  const agent = await getAgentForUser(agentId, userId, { mutate: true });
  const enabled = input.enabled !== false;
  const address = extractEmailAddress(input.address || "");
  const fromName = String(input.fromName || FROM_NAME_DEFAULT).slice(0, 80);

  if (enabled && !address) {
    const err = new Error("A valid inbound email address is required");
    err.status = 400;
    err.code = "EMAIL_CHANNEL_ADDRESS";
    throw err;
  }

  try {
    return await prisma.agent.update({
      where: { id: agent.id },
      data: {
        emailChannelAddress: enabled ? address : null,
        emailChannel: enabled
          ? { enabled: true, fromName }
          : { enabled: false, fromName },
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      const err = new Error(
        "That inbound address is already used by another agent"
      );
      err.status = 409;
      err.code = "EMAIL_CHANNEL_TAKEN";
      throw err;
    }
    throw error;
  }
}
