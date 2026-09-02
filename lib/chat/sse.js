/** SSE helpers for streaming chat responses. */

export function streamingChatEnabled() {
  return process.env.STREAMING_CHAT === "1";
}

export function formatSseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Parse one or more SSE events from a text buffer.
 * @returns {{ events: Array<{ type: string, data: unknown }>, rest: string }}
 */
export function parseSseBuffer(buffer) {
  const events = [];
  let rest = buffer;
  let idx = rest.indexOf("\n\n");
  while (idx !== -1) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    const lines = block.split("\n");
    let type = "message";
    let dataLine = "";
    for (const line of lines) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    }
    if (dataLine) {
      try {
        events.push({ type, data: JSON.parse(dataLine) });
      } catch {
        // ignore malformed chunk
      }
    }
    idx = rest.indexOf("\n\n");
  }
  return { events, rest };
}
