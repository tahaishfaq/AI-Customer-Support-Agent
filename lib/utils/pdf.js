import { PDFParse } from "pdf-parse";

/**
 * Extract plain text from a PDF buffer.
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<string>}
 */
export async function extractTextFromPdf(buffer) {
  const data =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    return String(result?.text || "").trim();
  } finally {
    await parser.destroy();
  }
}
