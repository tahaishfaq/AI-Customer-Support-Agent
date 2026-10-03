/**
 * Level 3 · L7 — embedding-boosted tool shortlist. Only ranking changes; PEP unchanged.
 */

import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { safeLogError } from "@/lib/observability/safe-log";
import { contentHash, embeddingToSqlLiteral, EMBEDDING_MODEL } from "@/lib/services/ai/embeddings-config";
import { embedTexts, isPgvectorAvailable } from "@/lib/services/ai/embeddings.service";
import { cosineSimilarity } from "@/lib/services/ai/rrf";
import { shortlistToolsForTurn, toolRelevance, contentTokens } from "@/lib/services/ai/tool-shortlist";

function toolKey(action) {
  return String(action?._mcp ? `mcp:${action.name}` : `http:${action.name}`);
}

function toolText(action) {
  return `${action?.name || ""}\n${action?.description || ""}`.slice(0, 2_000);
}

export async function ensureToolEmbeddings(agentId, actions) {
  if (!(await isPgvectorAvailable())) return;
  const list = (Array.isArray(actions) ? actions : []).filter((a) => a?._mcp || a?.name);
  for (const action of list.slice(0, 40)) {
    const key = toolKey(action);
    const text = toolText(action);
    const hash = contentHash(text);
    const existing = await prisma.toolEmbedding.findUnique({
      where: { agentId_toolKey: { agentId, toolKey: key } },
      select: { contentHash: true },
    });
    if (existing?.contentHash === hash) continue;
    const embedded = await embedTexts([text]);
    if (!embedded.ok || !embedded.vectors[0]) continue;
    const literal = embeddingToSqlLiteral(embedded.vectors[0]);
    const id = `te_${randomUUID().replace(/-/g, "")}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ToolEmbedding" (id, "agentId", "toolKey", "contentHash", embedding, model, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::vector, $6, NOW(), NOW())
       ON CONFLICT ("agentId", "toolKey")
       DO UPDATE SET "contentHash" = EXCLUDED."contentHash", embedding = EXCLUDED.embedding, model = EXCLUDED.model, "updatedAt" = NOW()`,
      id,
      agentId,
      key,
      hash,
      literal,
      EMBEDDING_MODEL
    );
  }
}

/**
 * Lexical shortlist + optional vector similarity boost for MCP ranking.
 */
export async function shortlistToolsWithMeaning(actions, opts = {}) {
  const base = shortlistToolsForTurn(actions, opts);
  if (!opts.semanticToolShortlist || !opts.agentId) return base;

  try {
    await ensureToolEmbeddings(opts.agentId, actions);
    const query = `${opts.carryUtterance || ""} ${opts.utterance || ""}`.trim();
    if (!query) return base;
    const embedded = await embedTexts([query.slice(0, 1_000)]);
    if (!embedded.ok || !embedded.vectors[0]) return base;

    const rows = await prisma.$queryRawUnsafe(
      `SELECT "toolKey", 1 - (embedding <=> $1::vector) AS score
       FROM "ToolEmbedding"
       WHERE "agentId" = $2 AND model = $3 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 30`,
      embeddingToSqlLiteral(embedded.vectors[0]),
      opts.agentId,
      EMBEDDING_MODEL
    );
    const scoreByKey = new Map(
      (Array.isArray(rows) ? rows : []).map((row) => [row.toolKey, Number(row.score) || 0])
    );
    const tokens = contentTokens(query);
    const mcp = (Array.isArray(actions) ? actions : [])
      .filter((a) => a?._mcp && !a._mcp?.authFailed)
      .map((action) => ({
        action,
        score:
          toolRelevance(action, tokens) +
          (scoreByKey.get(toolKey(action)) || 0) * 3,
      }))
      .sort((a, b) => b.score - a.score || String(a.action.name).localeCompare(String(b.action.name)));

    const keep = (Array.isArray(actions) ? actions : []).filter((a) => !a?._mcp);
    const maxMcp = opts.maxMcp || 12;
    return [...keep, ...mcp.slice(0, maxMcp).map((row) => row.action)];
  } catch (error) {
    safeLogError("shortlistToolsWithMeaning failed", { code: error?.code || "tool_embed_error" });
    return base;
  }
}

export { cosineSimilarity };
