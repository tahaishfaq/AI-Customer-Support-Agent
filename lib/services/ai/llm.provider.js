import OpenAI from "openai";

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
  return new OpenAI({ apiKey: apiKey.trim() });
}

function getModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/**
 * Chat completion via OpenAI.
 * @param {{ system: string, messages: Array<{ role: "user"|"assistant", content: string }> }}
 * @returns {Promise<{ content: string, latencyMs: number }>}
 */
export async function chatCompletion({ system, messages }) {
  const client = getClient();
  const started = Date.now();

  try {
    const completion = await client.chat.completions.create({
      model: getModel(),
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw httpError(502, "AI returned an empty reply");
    }

    return {
      content,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    if (error.status === 500 || error.status === 502) throw error;
    console.error("OpenAI chatCompletion failed", error?.message || error);
    throw httpError(502, "AI provider request failed");
  }
}

/**
 * Lightweight JSON-ish completion for classification.
 * @returns {Promise<string>} raw content
 */
export async function jsonCompletion({ system, user, temperature = 0.7 }) {
  const client = getClient();

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
    if (error.status === 500 || error.status === 502) throw error;
    console.error("OpenAI jsonCompletion failed", error?.message || error);
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
    console.error("OpenAI classifyCompletion failed", error?.message || error);
    throw error;
  }
}
