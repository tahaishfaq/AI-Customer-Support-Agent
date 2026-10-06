/**
 * Level 2 · P8 — pure inbound email helpers (parse, strip, thread, loop detect).
 * No DB / network. Body budget 25 KB.
 */

export const INBOUND_TEXT_MAX = 25 * 1024;

const AUTO_SUBMITTED_RE = /^(auto-replied|auto-generated|auto-notified)/i;
const NOREPLY_RE =
  /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce)@/i;

/**
 * @param {string|null|undefined} html
 * @returns {string}
 */
export function htmlToText(html) {
  const raw = String(html || "");
  if (!raw.trim()) return "";
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Strip quoted reply chains and common signature blocks.
 * @param {string} text
 */
export function stripQuotedReply(text) {
  let body = String(text || "").replace(/\r\n/g, "\n");
  const cutMarkers = [
    /\nOn .+ wrote:\s*\n/i,
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\nFrom:\s.+\nSent:\s/i,
    /\n_{2,}\n/,
    /\nGet Outlook for /i,
  ];
  for (const re of cutMarkers) {
    const m = body.match(re);
    if (m && typeof m.index === "number") {
      body = body.slice(0, m.index);
    }
  }
  // Line-quoted blocks at the end
  const lines = body.split("\n");
  let end = lines.length;
  while (end > 0 && /^>/.test(lines[end - 1].trim() || ">")) {
    end -= 1;
  }
  body = lines.slice(0, end).join("\n");
  // Trailing signature after -- 
  const sig = body.search(/\n-- \n/);
  if (sig >= 0) body = body.slice(0, sig);
  return body.trim();
}

/**
 * @param {{ text?: string|null, html?: string|null }} input
 * @returns {{ text: string, truncated: boolean, hadAttachmentNote: boolean }}
 */
export function extractInboundBody(input = {}) {
  let text = String(input.text || "").trim();
  if (!text && input.html) text = htmlToText(input.html);
  text = stripQuotedReply(text);
  let truncated = false;
  if (text.length > INBOUND_TEXT_MAX) {
    text = text.slice(0, INBOUND_TEXT_MAX);
    truncated = true;
  }
  return { text, truncated, hadAttachmentNote: false };
}

/**
 * @param {Record<string, string>|null|undefined} headers
 * @param {{ from?: string, subject?: string, ownAddresses?: string[] }} meta
 */
export function shouldIgnoreInbound(headers = {}, meta = {}) {
  const h = normalizeHeaders(headers);
  const auto = h["auto-submitted"] || "";
  if (auto && !/^no$/i.test(auto) && AUTO_SUBMITTED_RE.test(auto)) {
    return { ignore: true, reason: "auto-submitted" };
  }
  const precedence = (h.precedence || "").toLowerCase();
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") {
    return { ignore: true, reason: "precedence" };
  }
  const from = String(meta.from || h.from || "").trim();
  const fromAddr = extractEmailAddress(from);
  if (fromAddr && NOREPLY_RE.test(fromAddr)) {
    return { ignore: true, reason: "noreply" };
  }
  const own = new Set(
    (Array.isArray(meta.ownAddresses) ? meta.ownAddresses : [])
      .map((addr) => extractEmailAddress(addr))
      .filter(Boolean)
  );
  if (fromAddr && own.has(fromAddr)) {
    return { ignore: true, reason: "own-address" };
  }
  return { ignore: false, reason: null };
}

/**
 * @param {Record<string, string>|null|undefined} headers
 * @param {string} [subject]
 * @returns {{ inReplyTo: string|null, references: string[], threadToken: string|null }}
 */
export function parseThreadHints(headers = {}, subject = "") {
  const h = normalizeHeaders(headers);
  const inReplyTo = cleanMessageId(h["in-reply-to"] || "");
  const references = String(h.references || "")
    .split(/\s+/)
    .map(cleanMessageId)
    .filter(Boolean);
  const tokenMatch = String(subject || "").match(/\[aide:([a-z0-9_-]{6,40})\]/i);
  return {
    inReplyTo,
    references,
    threadToken: tokenMatch ? tokenMatch[1] : null,
  };
}

export function extractEmailAddress(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const angle = text.match(/<([^>]+@[^>]+)>/);
  const addr = (angle ? angle[1] : text).trim().toLowerCase();
  if (!addr.includes("@") || addr.length > 320) return null;
  return addr;
}

export function cleanMessageId(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const m = text.match(/<([^>]+)>/) || [null, text];
  const id = String(m[1] || "").trim();
  return id || null;
}

export function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== "object") return out;
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    out[String(key).toLowerCase()] = String(value);
  }
  return out;
}

/** Stable guest subject for unverified email senders (not proof of identity). */
export function emailGuestSubject(fromAddress) {
  const addr = extractEmailAddress(fromAddress) || "unknown";
  return `email:${addr}`;
}
