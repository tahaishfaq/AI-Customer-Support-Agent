function redactValue(value) {
  return "[redacted]";
}

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._\-+=/]{12,}\b/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(password|secret|api[_-]?key|private[_-]?key)\s*[:=]\s*\S+/gi,
  /(?:postgres|mysql|mongodb|redis):\/\/\S+/gi,
  /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
];

const ENV_LINE = /^\s*[A-Z][A-Z0-9_]{2,}\s*=\s*\S+/gm;

const PUBLIC_EMAIL_PREFIX =
  /^(support|help|hello|hi|info|contact|sales|billing)@/i;

export function lookLikePrivatePage(title, text) {
  const hay = `${title || ""} ${String(text || "").slice(0, 800)}`.toLowerCase();
  return (
    /\bstaff only\b/.test(hay) ||
    /\binternal only\b/.test(hay) ||
    /\bconfidential\b/.test(hay) ||
    /\bdatabase dump\b/.test(hay) ||
    /\bbackup of\b/.test(hay)
  );
}

export function redactPublicText(text) {
  let out = String(text || "");
  out = out.replace(ENV_LINE, redactValue(""));
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, redactValue(""));
  }

  out = out.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    (email) => (PUBLIC_EMAIL_PREFIX.test(email) ? email : "[email redacted]")
  );

  return out.replace(/\s+/g, " ").trim();
}
