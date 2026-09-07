import { apiFetch } from "@/lib/api-client";

export async function sendChatMessage(agentId, { message, conversationId }) {
  const body = { message };
  if (conversationId) body.conversationId = conversationId;

  return apiFetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Send chat with SSE support; falls back to the same JSON response when SSE is disabled. */
export async function sendChatMessageStream(
  agentId,
  { message, conversationId, onDelta, onEvent, onTool }
) {
  const response = await fetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "text/event-stream, application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversationId } : {}),
      stream: true,
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || "Unable to process chat");
      error.status = response.status;
      error.details = data?.error?.details || {};
      throw error;
    }
    return data;
  }

  if (!response.ok || !response.body) {
    throw new Error("Unable to open chat stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  const consume = (chunk) => {
    buffer += chunk;
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
      const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      let data;
      try {
        data = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }
      const type = eventLine ? eventLine.slice(6).trim() : "message";
      if (type === "delta" && data?.text) onDelta?.(data.text);
      else if (type === "done") result = data;
      else if (type === "error") {
        const error = new Error(data?.message || "Unable to process chat");
        error.details = { code: data?.code || null };
        throw error;
      } else {
        if (type === "tool") onTool?.(data);
        onEvent?.({ type, data });
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    consume(decoder.decode(value, { stream: true }));
  }
  consume(decoder.decode());
  if (!result) throw new Error("Chat stream ended without a result");
  return result;
}

export async function sendPublicChatMessageStream(
  publicKey,
  { message, conversationId, userSession, realtimeAccessToken, onDelta, onTool }
) {
  const headers = {
    Accept: "text/event-stream, application/json",
    "Content-Type": "application/json",
  };
  if (realtimeAccessToken) {
    headers["x-aide-conversation-access-token"] = realtimeAccessToken;
  }
  const response = await fetch(`/api/public/agents/${publicKey}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversationId } : {}),
      ...(userSession ? { userSession } : {}),
      stream: true,
    }),
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || "Unable to send message");
      error.status = response.status;
      error.details = data?.error?.details || {};
      throw error;
    }
    return data;
  }
  if (!response.ok || !response.body) throw new Error("Unable to open chat stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  const consume = (chunk) => {
    buffer += chunk;
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
      const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      let data;
      try { data = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
      const type = eventLine ? eventLine.slice(6).trim() : "message";
      if (type === "delta" && data?.text) onDelta?.(data.text);
      else if (type === "tool") onTool?.(data);
      else if (type === "done") result = data;
      else if (type === "error") {
        const error = new Error(data?.message || "Unable to send message");
        error.details = { code: data?.code || null };
        throw error;
      }
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    consume(decoder.decode(value, { stream: true }));
  }
  consume(decoder.decode());
  if (!result) throw new Error("Chat stream ended without a result");
  return result;
}

/** F14-A — continue tool execution after the user approved in chat UI. */
export async function resumeChatAfterConfirmation(
  agentId,
  { conversationId, confirmationId }
) {
  return apiFetch(`/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify({
      conversationId,
      resumeAfterConfirmationId: confirmationId,
    }),
  });
}

/** F14-A — embed: resume after public confirmation approve. */
export async function resumePublicChatAfterConfirmation(
  publicKey,
  { conversationId, confirmationId, userSession, realtimeAccessToken }
) {
  const headers = { "Content-Type": "application/json" };
  if (realtimeAccessToken) {
    headers["x-aide-conversation-access-token"] = realtimeAccessToken;
  }
  const res = await fetch(`/api/public/agents/${publicKey}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      conversationId,
      resumeAfterConfirmationId: confirmationId,
      ...(userSession ? { userSession } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || "Unable to resume chat");
    err.status = res.status;
    err.details = data?.error?.details || {};
    throw err;
  }
  return data;
}

export async function generateTestQuestions(agentId, { previousPrompts } = {}) {
  return apiFetch(`/api/agents/${agentId}/test-questions`, {
    method: "POST",
    body: JSON.stringify({ previousPrompts: previousPrompts || [] }),
  });
}
