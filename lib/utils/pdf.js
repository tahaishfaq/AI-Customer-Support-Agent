import { extractText, getDocumentProxy, definePDFJSModule } from "unpdf";

let pdfjsReady;

async function ensurePdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = definePDFJSModule(() => import("unpdf/pdfjs"));
  }
  await pdfjsReady;
}

function toBytes(buffer) {
  if (buffer instanceof Uint8Array) {
    return Uint8Array.from(buffer);
  }
  return Uint8Array.from(Buffer.from(buffer));
}

/**
 * Extract plain text from a PDF buffer (serverless-safe, no DOMMatrix).
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<string>}
 */
export async function extractTextFromPdf(buffer) {
  await ensurePdfjs();
  const data = toBytes(buffer);
  const pdf = await getDocumentProxy(data);
  const result = await extractText(pdf, { mergePages: true });
  return String(result?.text || "").trim();
}
