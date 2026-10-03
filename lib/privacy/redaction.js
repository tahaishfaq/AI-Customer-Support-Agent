/**
 * Level 3 · L6 — PII redaction patterns (pure). Mask before persist; model may see original for one turn.
 */

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;
const CNIC_RE = /\b\d{5}-\d{7}-\d\b/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;

export function luhnOk(digits) {
  const clean = String(digits || "").replace(/\D/g, "");
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    let n = Number(clean[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function normalizePrivacy(stored) {
  const raw = stored && typeof stored === "object" ? stored : {};
  const patterns = raw.patterns && typeof raw.patterns === "object" ? raw.patterns : {};
  const retention = raw.retentionDays;
  return {
    redactPii: Boolean(raw.redactPii),
    retentionDays:
      retention == null || retention === ""
        ? null
        : Math.min(3650, Math.max(30, Number(retention) || 30)),
    patterns: {
      email: patterns.email !== false,
      phone: patterns.phone !== false,
      card: patterns.card !== false,
      cnic: patterns.cnic !== false,
      iban: patterns.iban !== false,
    },
  };
}

export function redactPiiText(text, privacy) {
  const settings = normalizePrivacy(privacy);
  if (!settings.redactPii) return String(text || "");
  let out = String(text || "");
  if (settings.patterns.email) out = out.replace(EMAIL_RE, "[email]");
  if (settings.patterns.phone) out = out.replace(PHONE_RE, "[phone]");
  if (settings.patterns.cnic) out = out.replace(CNIC_RE, "[cnic]");
  if (settings.patterns.iban) out = out.replace(IBAN_RE, "[iban]");
  if (settings.patterns.card) {
    out = out.replace(CARD_RE, (match) => (luhnOk(match) ? "[card]" : match));
  }
  return out;
}
