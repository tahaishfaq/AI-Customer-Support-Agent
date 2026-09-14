import { createHash } from "node:crypto";

const sink = [];

export function pushEmailSink(entry) {
  sink.push({ ...entry, at: Date.now() });
}

export function drainEmailSink() {
  const out = sink.splice(0, sink.length);
  return out;
}

export function peekEmailSink() {
  return [...sink];
}

export function clearEmailSink() {
  sink.length = 0;
}

/** Hash recipient domain for safe structured logs (never full email in prod logs). */
export function recipientDomainHash(email) {
  const domain = String(email || "").split("@")[1] || "unknown";
  return createHash("sha256").update(domain.toLowerCase()).digest("hex").slice(0, 12);
}
