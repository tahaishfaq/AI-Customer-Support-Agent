/**
 * F11-U — strip common PII patterns from tool results before the LLM
 * (especially guest / public paths). Owner APIs should still send redacted JSON.
 */

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;

const SENSITIVE_KEYS = new Set([
  "email",
  "phone",
  "mobile",
  "ssn",
  "address",
  "street",
  "fullName",
  "full_name",
  "cardNumber",
  "card_number",
  "cvv",
  "password",
  "accessToken",
  "access_token",
  "refreshToken",
  "authorization",
]);

function redactString(s) {
  return String(s || "")
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(SSN_RE, "[redacted-ssn]")
    .replace(CARD_RE, "[redacted-card]")
    .replace(PHONE_RE, "[redacted-phone]");
}

function scrubValue(value, { aggressive }) {
  if (value == null) return value;
  if (typeof value === "string") {
    return aggressive ? redactString(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, { aggressive }));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (aggressive && SENSITIVE_KEYS.has(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = scrubValue(v, { aggressive });
    }
    return out;
  }
  return value;
}

/**
 * @param {string|object|null} body
 * @param {{ guest?: boolean, maxChars?: number }} [opts]
 * @returns {string}
 */
export function sanitizeToolBodyForModel(body, opts = {}) {
  const guest = Boolean(opts.guest);
  const maxChars = opts.maxChars ?? (guest ? 1200 : 2000);
  let text;
  if (body == null) text = "";
  else if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      text = JSON.stringify(scrubValue(parsed, { aggressive: guest }));
    } catch {
      text = guest ? redactString(body) : body;
    }
  } else {
    text = JSON.stringify(scrubValue(body, { aggressive: guest }));
  }
  if (text.length > maxChars) {
    return `${text.slice(0, maxChars)}…[truncated]`;
  }
  return text;
}

/**
 * Detect requests for another person's account data.
 * Heuristic only — owner API ACL remains mandatory.
 *
 * @param {string|null} utterance
 * @param {object|null} args
 * @param {string|null} customerSubject
 * @param {{ email?: string|null, phone?: string|null }|null} [customerClaims]
 */
export function detectCrossUserRequest(
  utterance,
  args = null,
  customerSubject = null,
  customerClaims = null
) {
  const text = String(utterance || "").toLowerCase();
  if (!text.trim() && !args) return false;

  if (text.trim()) {
    const crossPhrases = [
      /someone else/,
      /another (user|customer|account|person|patient|member)/,
      /\b(my friend|my wife|my husband|my coworker|colleague)('?s)?\b/,
      /\bfor (him|her|them)\b.*\b(order|account|invoice|ticket|appointment)\b/,
      /\b(show|get|fetch|lookup|look up)\b.*\b(user|customer)\s+[a-z0-9_-]+/i,
      /\ball customers\b/,
      /\blist (all )?users\b/,
      /\badmin (access|mode|override)\b/,
      /\bimpersonat(e|ion|ing)\b/,
      /\bact as (support|admin|another|other)\b/,
      /\bevery customer\b/,
      /\ball users(')? (orders|accounts|data)\b/,
    ];
    if (crossPhrases.some((re) => re.test(text))) return true;

    // Explicit email that is not "my email" framing while logged in
    if (
      customerSubject &&
      /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text) &&
      !/\bmy (email|account|order)\b/.test(text)
    ) {
      return true;
    }
  }

  // Stronger: tool args claiming another user id / foreign email / phone
  if (args && typeof args === "object" && !Array.isArray(args)) {
    const sub = String(customerSubject || "").trim();
    // Do NOT treat args.subject as identity — packs use it for ticket titles.
    const argUserId = String(
      args.userId || args.customerId || args.user_id || args.accountId || ""
    ).trim();
    if (sub && argUserId && argUserId !== sub) {
      return true;
    }

    const claimEmail = String(customerClaims?.email || "")
      .trim()
      .toLowerCase();
    const argEmail = String(args.email || args.userEmail || "")
      .trim()
      .toLowerCase();
    if (claimEmail && argEmail && argEmail !== claimEmail) {
      return true;
    }

    const claimPhone = normalizePhone(customerClaims?.phone);
    const argPhone = normalizePhone(args.phone || args.mobile);
    if (claimPhone && argPhone && argPhone !== claimPhone) {
      return true;
    }

    // Logged-in + foreign-looking email in args without matching claim
    if (
      sub &&
      argEmail &&
      !claimEmail &&
      /\b(for|of)\b.+\b(user|customer|friend|him|her)\b/i.test(
        String(utterance || "")
      )
    ) {
      return true;
    }
  }

  return false;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}
