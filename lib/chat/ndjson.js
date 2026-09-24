/** NDJSON helpers for streaming chat: one JSON object per `\n`-terminated line. */

export const NDJSON_CONTENT_TYPE = "application/x-ndjson";

/**
 * Token streaming is on by default. Set STREAMING_CHAT=0 to force JSON-only replies.
 */
export function streamingChatEnabled() {
  const raw = process.env.STREAMING_CHAT;
  if (raw == null || String(raw).trim() === "") return true;
  return String(raw).trim() !== "0" && String(raw).trim().toLowerCase() !== "false";
}

export function acceptsNdjson(request) {
  return (request.headers.get("accept") || "").includes(NDJSON_CONTENT_TYPE);
}

export function formatNdjsonLine(event) {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Parse complete lines from a text buffer; the unterminated tail stays in `rest`.
 * @returns {{ events: Array<Record<string, unknown>>, rest: string }}
 */
export function parseNdjsonBuffer(buffer) {
  const events = [];
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  for (const raw of lines) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event && typeof event.type === "string") events.push(event);
    } catch {
      // ignore malformed line
    }
  }
  return { events, rest };
}
