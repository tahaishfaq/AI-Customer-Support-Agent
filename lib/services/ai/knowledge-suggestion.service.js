/**
 * Level 3 · L3 — knowledge-gap suggestions (owner review required).
 */

import prisma from "@/lib/prisma";
import { safeLogError } from "@/lib/observability/safe-log";
import { jsonCompletion } from "@/lib/services/ai/llm.provider";
import {
  clusterKeyForQuestion,
  clusterQuestions,
  findAnsweredDocument,
  findConflictingDocument,
  hasNewQuestionsSinceDismiss,
  isAnsweredByKnowledge,
  scrubPii,
} from "@/lib/services/ai/knowledge-gap";
import { embedTexts, scheduleDocumentEmbed } from "@/lib/services/ai/embeddings.service";
import { createTextKnowledge, loadKnowledgeDocsForRetrieval } from "@/lib/services/knowledge.service";
import { resolveAgentWorkspaceAccess } from "@/lib/services/agent.service";

const UNANSWERED = new Set(["NO_EVIDENCE", "NOT_FOUND"]);

export async function collectGapCandidates(agentId, { take = 40 } = {}) {
  const unanswered = await prisma.message.findMany({
    where: {
      role: "ASSISTANT",
      answerState: { in: [...UNANSWERED] },
      conversation: { agentId, source: { in: ["EMBED", "EMAIL"] } },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      conversationId: true,
      createdAt: true,
      conversation: {
        select: {
          messages: {
            where: { role: "USER" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true },
          },
        },
      },
    },
  });

  const humanResolved = await prisma.conversation.findMany({
    where: { agentId, resolvedBy: "HUMAN", source: { in: ["EMBED", "EMAIL"] } },
    orderBy: { createdAt: "desc" },
    take: Math.ceil(take / 2),
    select: {
      id: true,
      messages: {
        where: { role: { in: ["USER", "HUMAN"] } },
        orderBy: { createdAt: "asc" },
        take: 6,
        select: { role: true, content: true },
      },
    },
  });

  const items = [];
  for (const row of unanswered) {
    const q = row.conversation?.messages?.[0]?.content;
    if (q) items.push({ id: row.id, text: q, conversationId: row.conversationId });
  }
  for (const conv of humanResolved) {
    const user = conv.messages.find((m) => m.role === "USER");
    if (user?.content) items.push({ id: conv.id, text: user.content, conversationId: conv.id });
  }
  return items;
}

export async function draftSuggestionFromCluster(cluster, humanReplies = []) {
  const scrubbedQs = (cluster.samples || []).map(scrubPii);
  const scrubbedAnswers = humanReplies.map(scrubPii).filter(Boolean).slice(0, 5);
  if (!scrubbedAnswers.length) {
    return {
      title: scrubbedQs[0]?.slice(0, 80) || "Knowledge gap",
      draftAnswer: "",
      skipped: "no_human_reply",
    };
  }

  try {
    const raw = await jsonCompletion({
      system:
        "Draft a short FAQ answer for a support knowledge base. Use ONLY the human agent replies as evidence. Customer questions are context. Strip any remaining PII. Return JSON {title, draftAnswer}. Never invent policy.",
      user: JSON.stringify({ questions: scrubbedQs, humanReplies: scrubbedAnswers }),
      temperature: 0.2,
    });
    const parsed = JSON.parse(raw);
    return {
      title: scrubPii(String(parsed.title || scrubbedQs[0] || "FAQ")).slice(0, 80),
      draftAnswer: scrubPii(String(parsed.draftAnswer || "")).slice(0, 4_000),
    };
  } catch (error) {
    safeLogError("draftSuggestionFromCluster failed", { code: error?.code || "draft_error" });
    return {
      title: (scrubbedQs[0] || "Knowledge gap").slice(0, 80),
      draftAnswer: scrubbedAnswers[0].slice(0, 4_000),
    };
  }
}

async function parseChunkEmbeddings(agentId, limit = 40) {
  const chunkRows = await prisma
    .$queryRawUnsafe(
      `SELECT embedding::text AS embedding FROM "KnowledgeChunk" WHERE "agentId" = $1 AND embedding IS NOT NULL LIMIT $2`,
      agentId,
      limit
    )
    .catch(() => []);
  const vectors = [];
  for (const row of Array.isArray(chunkRows) ? chunkRows : []) {
    const raw = String(row?.embedding || "").replace(/^\[|\]$/g, "");
    if (!raw) continue;
    const vec = raw.split(",").map((n) => Number(n.trim()));
    if (vec.length && vec.every((n) => Number.isFinite(n))) vectors.push(vec);
  }
  return vectors;
}

export async function refreshKnowledgeSuggestions(agentId, { userId } = {}) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, workspaceId: true, userId: true, semanticRagEnabled: true },
  });
  if (!agent) throw Object.assign(new Error("Agent not found"), { status: 404 });
  if (userId) {
    const access = await resolveAgentWorkspaceAccess(agent, userId);
    if (!access.canManage) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
  }

  const candidates = await collectGapCandidates(agentId);
  if (!candidates.length) return { created: 0, clusters: 0 };

  let withVectors = candidates;
  if (agent.semanticRagEnabled) {
    const embedded = await embedTexts(candidates.map((c) => c.text));
    if (embedded.ok) {
      withVectors = candidates.map((c, i) => ({ ...c, embedding: embedded.vectors[i] }));
    }
  }

  const knowledgeDocs = await loadKnowledgeDocsForRetrieval(agentId, {
    select: { id: true, name: true, content: true },
  });
  const knowledgeVectors = agent.semanticRagEnabled
    ? await parseChunkEmbeddings(agentId)
    : [];

  const clusters = clusterQuestions(withVectors).slice(0, 10);
  let created = 0;

  for (const cluster of clusters) {
    const existing = await prisma.knowledgeSuggestion.findUnique({
      where: {
        agentId_clusterKey: { agentId, clusterKey: cluster.clusterKey },
      },
    });
    if (existing?.status === "accepted") continue;
    if (existing?.status === "dismissed") {
      if (
        !hasNewQuestionsSinceDismiss(
          existing.sourceConversationIds,
          cluster.conversationIds
        )
      ) {
        continue;
      }
    }

    if (
      cluster.centroid &&
      knowledgeVectors.length &&
      isAnsweredByKnowledge(cluster.centroid, knowledgeVectors, 0.88)
    ) {
      continue;
    }
    const answered = findAnsweredDocument(cluster.samples, knowledgeDocs);
    if (answered) continue;

    const humanReplies = [];
    for (const conversationId of cluster.conversationIds.slice(0, 3)) {
      const msgs = await prisma.message.findMany({
        where: { conversationId, role: "HUMAN" },
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { content: true },
      });
      humanReplies.push(...msgs.map((m) => m.content));
    }

    const draft = await draftSuggestionFromCluster(cluster, humanReplies);
    if (!draft.draftAnswer) continue;

    const conflict = findConflictingDocument(draft.draftAnswer, knowledgeDocs);

    await prisma.knowledgeSuggestion.upsert({
      where: { agentId_clusterKey: { agentId, clusterKey: cluster.clusterKey } },
      create: {
        agentId,
        workspaceId: agent.workspaceId,
        status: "pending",
        clusterKey: cluster.clusterKey,
        title: draft.title,
        draftAnswer: draft.draftAnswer,
        questionSamples: cluster.samples,
        sourceConversationIds: cluster.conversationIds.slice(0, 20),
        conflictWithDocumentId: conflict?.documentId || null,
      },
      update: {
        title: draft.title,
        draftAnswer: draft.draftAnswer,
        questionSamples: cluster.samples,
        sourceConversationIds: cluster.conversationIds.slice(0, 20),
        conflictWithDocumentId: conflict?.documentId || null,
        updatedAt: new Date(),
        status: "pending",
      },
    });
    created += 1;
  }

  return { created, clusters: clusters.length };
}

export async function listKnowledgeSuggestions(agentId, { status } = {}) {
  return prisma.knowledgeSuggestion.findMany({
    where: {
      agentId,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function reviewKnowledgeSuggestion({
  suggestionId,
  userId,
  action,
  title,
  draftAnswer,
}) {
  const suggestion = await prisma.knowledgeSuggestion.findUnique({
    where: { id: suggestionId },
    include: { agent: { select: { id: true, userId: true, workspaceId: true } } },
  });
  if (!suggestion) throw Object.assign(new Error("Not found"), { status: 404 });

  const access = await resolveAgentWorkspaceAccess(suggestion.agent, userId);
  if (!access.canManage) {
    throw Object.assign(new Error("Only Owner/Admin can approve suggestions"), {
      status: 403,
    });
  }

  if (action === "dismiss") {
    return prisma.knowledgeSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: "dismissed",
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });
  }

  if (action !== "accept") {
    throw Object.assign(new Error("Invalid action"), { status: 400 });
  }

  const finalTitle = scrubPii(title || suggestion.title).slice(0, 80);
  const finalAnswer = scrubPii(draftAnswer || suggestion.draftAnswer).slice(0, 8_000);
  const doc = await createTextKnowledge(suggestion.agentId, userId, {
    name: finalTitle,
    content: finalAnswer,
  });
  scheduleDocumentEmbed(doc);

  return prisma.knowledgeSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: "accepted",
      title: finalTitle,
      draftAnswer: finalAnswer,
      publishedDocumentId: doc.id,
      reviewedAt: new Date(),
      reviewedByUserId: userId,
    },
  });
}

export { clusterKeyForQuestion };
