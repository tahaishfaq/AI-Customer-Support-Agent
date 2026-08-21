import { ocrImageUrl } from "@/lib/services/ai/llm.provider";
import { extractTextFromPdf } from "@/lib/utils/pdf";

const IMAGE = /^(image\/(jpeg|png|webp|gif))$/i;
const PDF = /^(application\/pdf)$/i;
const TEXT = /^(text\/(plain|csv|markdown)|application\/(json|xml))$/i;

export async function extractUploadedFileText({
  buffer,
  mimeType,
  fileName,
  fileUrl,
  kind,
}) {
  const mime = String(mimeType || "");
  const name = String(fileName || "").toLowerCase();

  try {
    if (kind === "image" || IMAGE.test(mime)) {
      if (!fileUrl) return "";
      return (await ocrImageUrl(fileUrl)).slice(0, 8000);
    }

    if (PDF.test(mime) || name.endsWith(".pdf")) {
      const text = await extractTextFromPdf(buffer);
      return String(text || "").replace(/\s+/g, " ").trim().slice(0, 8000);
    }

    if (TEXT.test(mime) || /\.(txt|csv|md|json)$/i.test(name)) {
      return buffer.toString("utf8").replace(/\u0000/g, "").slice(0, 8000);
    }
  } catch (error) {
    console.error("extractUploadedFileText", error?.message || error);
  }

  return "";
}
