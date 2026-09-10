import OpenAI from "openai";
import { safeLogError } from "@/lib/observability/safe-log";
import { normalizeOpenAiError } from "./openai-errors";
import { parseWebSearchEvent, parseWebSearchResponse } from "./web-search-result";
import { getWebSearchModel } from "./web-search-config";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw httpError(503, "AI is not configured", {
      code: "ai_not_configured",
      openai: "Set OPENAI_API_KEY in the server environment",
    });
  }
  // maxRetries: 0 — OpenAI SDK default (2) doubles cost on timeout/5xx.
  // Chat already returns a safe degraded reply; do not auto-retry.
  return new OpenAI({
    apiKey: apiKey.trim(),
    maxRetries: 0,
    timeout: Number(process.env.OPENAI_TIMEOUT_MS) || 45_000,
  });
}

function getModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function isAbortError(error) {
  return (
    error?.name === "AbortError" ||
    error?.code === "ABORT_ERR" ||
    error?.message === "Request was aborted." ||
    /aborted/i.test(String(error?.message || ""))
  );
}

function isTimeoutError(error) {
  if (!error) return false;
  if (error.status === 504 || error.code === "ETIMEDOUT") return true;
  if (error.name === "APIConnectionTimeoutError") return true;
  const msg = String(error.message || "");
  return /timeout|timed out|deadline/i.test(msg);
}

export function buildResponsesWebSearchPayload({ system, messages }) {
  return {
    model: getWebSearchModel(),
    instructions: String(system || ""),
    input: (Array.isArray(messages) ? messages : []).map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content || ""),
    })),
    tools: [{ type: "web_search", search_context_size: "medium" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
  };
}

export async function responsesTurn({ system, messages, signal }) {
  const client = getClient();
  const started = Date.now();
  try {
    const response = await client.responses.create(
      buildResponsesWebSearchPayload({ system, messages }),
      signal ? { signal } : undefined
    );
    const parsed = parseWebSearchResponse(response);
    if (!parsed.searchUsed) {
      throw httpError(502, "Hosted web search was not executed", {
        code: "WEB_SEARCH_NOT_USED",
      });
    }
    if (!parsed.text.trim()) {
      throw httpError(502, "AI returned an empty web-search reply");
    }
    return {
      content: parsed.text.trim(),
      citations: parsed.citations,
      sources: parsed.sources,
      searchActions: parsed.searchActions,
      responseId: parsed.responseId,
      searchUsed: parsed.searchUsed,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const normalized = normalizeOpenAiError(error);
    if (normalized) {
      throw httpError(normalized.status, normalized.message, { code: normalized.code });
    }
    if (error.status === 500 || error.status === 502 || error.status === 503) throw error;
    if (isAbortError(error) || signal?.aborted) {
      safeLogError("OpenAI responses web search aborted", { code: "ABORTED", durationMs });
      throw httpError(499, "Request cancelled", { code: "ABORTED" });
    }
    if (isTimeoutError(error)) {
      safeLogError("OpenAI responses web search timeout", { code: "TIMEOUT", durationMs });
      throw httpError(504, "The AI took too long. Your message was saved — try again.", { code: "TIMEOUT" });
    }
    safeLogError("OpenAI responses web search failed", {
      code: error?.code || error?.status || undefined,
      durationMs,
    });
    throw httpError(502, "Web search provider request failed", {
      code: "WEB_SEARCH_FAILED",
    });
  }
}

/**
 * Stream a hosted web-search response. Provider events are normalized before
 * they leave this module; callers never receive raw OpenAI payloads.
 * @param {{ system: string, messages: Array<{ role: string, content: string }>, signal?: AbortSignal, onEvent?: (event: object) => void }} params
 */
export async function responsesStreamTurn({ system, messages, signal, onEvent }) {
  const client = getClient();
  const started = Date.now();
  let completedResponse = null;
  let text = "";
  let searchUsed = false;

  try {
    const stream = await client.responses.create(
      { ...buildResponsesWebSearchPayload({ system, messages }), stream: true },
      signal ? { signal } : undefined
    );

    for await (const event of stream) {
      if (signal?.aborted) throw httpError(499, "Request cancelled", { code: "ABORTED" });
      const normalized = parseWebSearchEvent(event);
      if (normalized?.type === "delta") {
        text += normalized.text;
        if (normalized.text && onEvent) onEvent(normalized);
      } else if (normalized?.type === "search") {
        searchUsed = true;
        if (onEvent) onEvent({ type: "search", data: normalized });
      }
      if (event?.type === "response.completed" && event.response) {
        completedResponse = event.response;
      }
    }

    const parsed = parseWebSearchResponse(completedResponse || { output_text: text });
    if (!parsed.searchUsed && !searchUsed) {
      throw httpError(502, "Hosted web search was not executed", { code: "WEB_SEARCH_NOT_USED" });
    }
    const content = String(parsed.text || text).trim();
    if (!content) throw httpError(502, "AI returned an empty web-search reply");
    return {
      content,
      citations: parsed.citations,
      sources: parsed.sources,
      searchActions: parsed.searchActions,
      responseId: parsed.responseId,
      searchUsed: parsed.searchUsed || searchUsed,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const normalized = normalizeOpenAiError(error);
    if (normalized) throw httpError(normalized.status, normalized.message, { code: normalized.code });
    if (error.status === 499 || error.status === 500 || error.status === 502 || error.status === 503) throw error;
    if (isAbortError(error) || signal?.aborted) {
      safeLogError("OpenAI responses web search stream aborted", { code: "ABORTED", durationMs });
      throw httpError(499, "Request cancelled", { code: "ABORTED" });
    }
    if (isTimeoutError(error)) {
      safeLogError("OpenAI responses web search stream timeout", { code: "TIMEOUT", durationMs });
      throw httpError(504, "The AI took too long. Your message was saved — try again.", { code: "TIMEOUT" });
    }
    safeLogError("OpenAI responses web search stream failed", {
      code: error?.code || error?.status || undefined,
      durationMs,
    });
    throw httpError(502, "Web search provider request failed", { code: "WEB_SEARCH_FAILED" });
  }
}

/**
 * Chat completion via OpenAI.
 * @param {{ system: string, messages: Array<{ role: "user"|"assistant", content: string }>, signal?: AbortSignal }}
 * @returns {Promise<{ content: string, latencyMs: number }>}
 */
export async function chatCompletion({ system, messages, signal }) {
  const turn = await chatCompletionTurn({ system, messages, signal });
  const content = String(turn.content || "").trim();
  if (!content) {
    throw httpError(502, "AI returned an empty reply");
  }
  return {
    content,
    latencyMs: turn.latencyMs,
  };
}

/**
 * One OpenAI chat turn — may return tool_calls instead of (or with) text.
 * @param {{
 *   system: string,
 *   messages: Array<Record<string, unknown>>,
 *   tools?: Array<object>,
 *   signal?: AbortSignal,
 * }}
 * @returns {Promise<{ content: string|null, toolCalls: Array|null, latencyMs: number }>}
 */
export async function chatCompletionTurn({
  system,
  messages,
  tools,
  signal,
}) {
  const client = getClient();
  const started = Date.now();

  try {
    const payload = {
      model: getModel(),
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => normalizeTurnMessage(m)),
      ],
    };
    if (Array.isArray(tools) && tools.length) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    const completion = await client.chat.completions.create(
      payload,
      signal ? { signal } : undefined
    );

    const message = completion.choices?.[0]?.message;
    const toolCalls = Array.isArray(message?.tool_calls)
      ? message.tool_calls
      : null;
    const content =
      typeof message?.content === "string" ? message.content : null;

    if (!toolCalls?.length && !String(content || "").trim()) {
      throw httpError(502, "AI returned an empty reply");
    }

    return {
      content,
      toolCalls,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const normalized = normalizeOpenAiError(error);
    if (normalized) throw httpError(normalized.status, normalized.message, { code: normalized.code });
    if (error.status === 500 || error.status === 502 || error.status === 503) throw error;

    if (isAbortError(error) || signal?.aborted) {
      safeLogError("OpenAI chatCompletion aborted", {
        code: "ABORTED",
        durationMs,
      });
      throw httpError(499, "Request cancelled", { code: "ABORTED" });
    }

    if (isTimeoutError(error)) {
      safeLogError("OpenAI chatCompletion timeout", {
        code: "TIMEOUT",
        durationMs,
      });
      throw httpError(
        504,
        "The AI took too long. Your message was saved — try again.",
        { code: "TIMEOUT" }
      );
    }

    safeLogError("OpenAI chatCompletion failed", {
      code: error?.code || error?.status || undefined,
      durationMs,
    });
    throw httpError(502, "AI provider request failed");
  }
}

/**
 * Stream chat completion tokens from OpenAI (no tools).
 * @param {{ system: string, messages: Array<{ role: "user"|"assistant", content: string }>, signal?: AbortSignal }}
 * @returns {AsyncGenerator<string>}
 */
export async function* chatCompletionStream({ system, messages, signal }) {
  const client = getClient();
  const started = Date.now();

  try {
    const stream = await client.chat.completions.create(
      {
        model: getModel(),
        temperature: 0.2,
        stream: true,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => normalizeTurnMessage(m)),
        ],
      },
      signal ? { signal } : undefined
    );

    for await (const chunk of stream) {
      if (signal?.aborted) {
        throw httpError(499, "Request cancelled", { code: "ABORTED" });
      }
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }

    if (Date.now() - started < 1) {
      // no-op — keep started for future metrics
    }
  } catch (error) {
    const durationMs = Date.now() - started;
    const normalized = normalizeOpenAiError(error);
    if (normalized) throw httpError(normalized.status, normalized.message, { code: normalized.code });
    if (error.status === 500 || error.status === 502 || error.status === 503 || error.status === 499) {
      throw error;
    }

    if (isAbortError(error) || signal?.aborted) {
      safeLogError("OpenAI chatCompletionStream aborted", {
        code: "ABORTED",
        durationMs,
      });
      throw httpError(499, "Request cancelled", { code: "ABORTED" });
    }

    if (isTimeoutError(error)) {
      safeLogError("OpenAI chatCompletionStream timeout", {
        code: "TIMEOUT",
        durationMs,
      });
      throw httpError(
        504,
        "The AI took too long. Your message was saved — try again.",
        { code: "TIMEOUT" }
      );
    }

    safeLogError("OpenAI chatCompletionStream failed", {
      code: error?.code || error?.status || undefined,
      durationMs,
    });
    throw httpError(502, "AI provider request failed");
  }
}

function normalizeTurnMessage(m) {
  if (!m || typeof m !== "object") {
    return { role: "user", content: "" };
  }
  if (m.role === "tool") {
    return {
      role: "tool",
      tool_call_id: m.tool_call_id,
      content: m.content ?? "",
    };
  }
  if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
    return {
      role: "assistant",
      content: m.content ?? null,
      tool_calls: m.tool_calls,
    };
  }
  return {
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content ?? "",
  };
}


/**
 * Lightweight JSON-ish completion for classification.
 * @returns {Promise<string>} raw content
 */
export async function jsonCompletion({ system, user, temperature = 0.7 }) {
  const client = getClient();
  const started = Date.now();

  try {
    const completion = await client.chat.completions.create({
      model: getModel(),
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw httpError(502, "AI returned an empty reply");
    }
    return content;
  } catch (error) {
    const durationMs = Date.now() - started;
    const normalized = normalizeOpenAiError(error);
    if (normalized) throw httpError(normalized.status, normalized.message, { code: normalized.code });
    if (error.status === 500 || error.status === 502) throw error;
    safeLogError("OpenAI jsonCompletion failed", {
      code: error?.code || error?.status || undefined,
      durationMs,
    });
    throw httpError(502, "AI provider request failed");
  }
}

/**
 * Lightweight JSON-ish completion for classification.
 * @returns {Promise<string>} raw content
 */
export async function classifyCompletion(system, userText) {
  const client = getClient();

  try {
    const completion = await client.chat.completions.create({
      model: getModel(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
    });

    return completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    safeLogError("OpenAI classifyCompletion failed", {
      code: error?.code || error?.status || undefined,
    });
    throw error;
  }
}

/**
 * OCR / describe a public image URL.
 */
export async function ocrImageUrl(imageUrl) {
  const client = getClient();
  try {
    const completion = await client.chat.completions.create({
      model: getModel(),
      temperature: 0,
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract every readable word (OCR). Keep original language. If there is little or no text, describe the image in short factual bullets. Do not guess brand-new facts.",
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });
    return completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    safeLogError("OpenAI ocrImageUrl failed", {
      code: error?.code || error?.status || undefined,
    });
    return "";
  }
}
