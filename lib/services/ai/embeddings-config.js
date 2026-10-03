/**
 * Level 3 · L1 — content hashing + embed chunk caps (pure).
 */

import { createHash } from "node:crypto";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;
export const MAX_EMBED_CHUNKS_PER_DOC = 40;
export const QUERY_EMBED_BUDGET_MS = 1_500;
export const EMBED_TIMEOUT_MS = 8_000;

export function contentHash(text) {
  return createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

export function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

/** Cap chunks for embedding; large docs keep head+tail coverage. */
export function capEmbedChunks(chunks, max = MAX_EMBED_CHUNKS_PER_DOC) {
  const list = Array.isArray(chunks) ? chunks : [];
  if (list.length <= max) return { chunks: list, capped: false };
  const head = Math.ceil(max * 0.7);
  const tail = max - head;
  return {
    chunks: [...list.slice(0, head), ...list.slice(-tail)],
    capped: true,
  };
}

export function embeddingToSqlLiteral(values) {
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) {
    throw new Error("Invalid embedding dimensions");
  }
  return `[${values.map((n) => Number(n) || 0).join(",")}]`;
}

export function isSemanticRagConfigured(agent) {
  return Boolean(agent?.semanticRagEnabled);
}
