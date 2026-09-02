import { parseSseBuffer } from "@/lib/chat/sse";

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Stream a studio chat message via SSE (O3.1 — works with tools).
 * Tool rounds emit `tool` events; final text emits `delta`.
 * Falls back to JSON if server returns application/json.
 */
export async function sendChatMessageStream(
  agentId,
  { message, conversationId, signal },
  handlers = {}
) {
  const body = { message, stream: true };
  if (conversationId) body.conversationId = conversationId;

  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  const csrf = getCsrfToken();
  if (csrf) headers["x-csrf-token"] = csrf;

  const res = await fetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
    credentials: "same-origin",
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || "Unable to send message");
  }

  if (contentType.includes("application/json")) {
    const result = await res.json();
    handlers.onDone?.(result);
    return result;
  }

  if (!res.body) {
    throw new Error("Streaming not supported in this browser");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = null;

  function handleEvents(events) {
    for (const event of events) {
      if (event.type === "meta") handlers.onMeta?.(event.data);
      if (event.type === "tool") handlers.onTool?.(event.data);
      if (event.type === "delta") handlers.onDelta?.(event.data?.text || "");
      if (event.type === "done") {
        finalResult = event.data;
        handlers.onDone?.(event.data);
      }
      if (event.type === "error") {
        throw new Error(event.data?.message || "Stream failed");
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
    }
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;
    handleEvents(parsed.events);
    if (done) break;
  }

  if (buffer.trim()) {
    const parsed = parseSseBuffer(`${buffer}\n\n`);
    handleEvents(parsed.events);
  }

  if (!finalResult) {
    throw new Error("Stream ended without a reply");
  }
  return finalResult;
}
