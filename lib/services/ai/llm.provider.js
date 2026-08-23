import OpenAI from "openai";
import { safeLogError } from "@/lib/observability/safe-log";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw httpError(500, "AI is not configured", {
      openai: "Set OPENAI_API_KEY in .env",
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

/**
 * Chat completion via OpenAI.
 * @param {{ system: string, messages: Array<{ role: "user"|"assistant", content: string }>, signal?: AbortSignal }}
 * @returns {Promise<{ content: string, latencyMs: number }>}
 */
export async function chatCompletion({ system, messages, signal }) {
  const client = getClient();
  const started = Date.now();

  try {
    const completion = await client.chat.completions.create(
      {
        model: getModel(),
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      },
      signal ? { signal } : undefined
    );

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw httpError(502, "AI returned an empty reply");
    }

    return {
      content,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    if (error.status === 500 || error.status === 502) throw error;

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
