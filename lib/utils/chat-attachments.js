const FILE_META_RE = /<!--hapy-file:([\s\S]*?)-->/;
const EXTRACT_RE = /<!--hapy-extract-->([\s\S]*?)<!--\/hapy-extract-->/;

/** Chat interface uploads (studio + public widget). */
export const CHAT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export function formatChatUploadLimit() {
  return "5MB";
}

export function parseChatAttachment(content) {
  const raw = String(content || "");
  const metaMatch = raw.match(FILE_META_RE);
  let meta = null;
  if (metaMatch?.[1]) {
    try {
      const parsed = JSON.parse(metaMatch[1]);
      if (parsed && typeof parsed === "object") meta = parsed;
    } catch {
      meta = null;
    }
  }
  const extracted = raw.match(EXTRACT_RE)?.[1]?.trim() || "";
  const display = raw.replace(FILE_META_RE, "").replace(EXTRACT_RE, "").trim();
  return { meta, extracted, display };
}

export function contentForLlm(content) {
  const { meta, extracted, display } = parseChatAttachment(content);
  if (!meta && !extracted) return String(content || "");
  const label = meta
    ? `Uploaded ${meta.kind || "file"}: ${meta.name || "attachment"}`
    : "Uploaded file";
  const body = extracted
    ? extracted.slice(0, 8000)
    : "(No text could be read from this file.)";
  return `${display}\n\n[${label}]\nExtracted content:\n${body}`;
}

export function buildAttachmentMessage({ kind, name, fileUrl, extracted }) {
  const safeName = String(name || "attachment").replace(/-->/g, "").slice(0, 80);
  const visible =
    kind === "image"
      ? `![${safeName}](${fileUrl})`
      : `Attached file: [${safeName}](${fileUrl})`;
  const meta = JSON.stringify({
    kind: kind === "image" ? "image" : kind === "pdf" ? "pdf" : "file",
    name: safeName,
    fileUrl,
  });
  const extractBlock = extracted
    ? `\n\n<!--hapy-extract-->\n${String(extracted).slice(0, 8000)}\n<!--/hapy-extract-->`
    : "";
  return `${visible}\n\n<!--hapy-file:${meta}-->${extractBlock}`;
}
