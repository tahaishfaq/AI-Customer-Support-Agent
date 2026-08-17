import { extractText } from "unpdf";

/**
 * Extract plain text from a PDF buffer (serverless-safe, no DOMMatrix).
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<string>}
 */
export async function extractTextFromPdf(buffer) {
  const data =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

  const result = await extractText(data, { mergePages: true });
  return String(result?.text || "").trim();
}
