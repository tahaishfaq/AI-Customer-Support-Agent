/**
 * Level 3 · L2 — sample + score settled conversations in after().
 */

import prisma from "@/lib/prisma";
import { safeLogError } from "@/lib/observability/safe-log";
import { jsonCompletion } from "@/lib/services/ai/llm.provider";
import {
  QA_UNAVAILABLE,
  normalizeQaSettings,
  parseQaJudgeJson,
  qaJudgeSystemPrompt,
  shouldSampleConversation,
} from "@/lib/services/ai/qa-judge";

const SETTLE_MS = 24 * 60 * 60 * 1000;

function collectSourceDocIds(messages) {
  const ids = new Set();
  for (const msg of messages || []) {
    const sources = Array.isArray(msg.sources) ? msg.sources : [];
    for (const src of sources) {
      const id = src?.id || src?.documentId || src?.knowledgeId;
      if (id) ids.add(String(id));
    }
    const citations = Array.isArray(msg.citations) ? msg.citations : [];
    for (const cite of citations) {
      const id = cite?.id || cite?.documentId;
      if (id) ids.add(String(id));
    }
  }
  return [...ids].slice(0, 12);
}

async function buildKnowledgeExcerpts(messages, agentId) {
  const parts = [];
  for (const msg of messages || []) {
    if (msg.role !== "ASSISTANT") continue;
    const sources = Array.isArray(msg.sources) ? msg.sources : [];
    for (const src of sources.slice(0, 6)) {
      const name = String(src?.name || src?.title || "Knowledge").slice(0, 120);
      const excerpt = String(src?.excerpt || src?.content || src?.snippet || "").slice(0, 600);
      if (excerpt) parts.push(`### ${name}\n${excerpt}`);
    }
  }

  const docIds = collectSourceDocIds(messages);
  if (docIds.length && agentId) {
    const docs = await prisma.knowledgeDocument.findMany({
      where: {
        id: { in: docIds },
        OR: [{ agentId }, { shares: { some: { consumerAgentId: agentId } } }],
      },
      select: { id: true, name: true, content: true },
      take: 12,
    });
    for (const doc of docs) {
      parts.push(
        `### ${String(doc.name || "Knowledge").slice(0, 120)}\n${String(doc.content || "").slice(0, 800)}`
      );
    }
  }

  const text = parts.join("\n\n").slice(0, 6_000);
  return text || "(no knowledge excerpts attached for this conversation)";
}

export async function maybeScoreSettledConversation(conversationId, { requestId } = {}) {
  if (!conversationId) return;
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        source: true,
        agentId: true,
        agent: {
          select: {
            workspaceId: true,
            workspace: { select: { qaSettings: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    if (!conversation) return;
    if (conversation.source === "STUDIO") return;

    const settings = normalizeQaSettings(conversation.agent?.workspace?.qaSettings);
    if (!settings.enabled) return;
    if (!shouldSampleConversation(conversation.id, settings.sampleRate)) return;

    const lastAt = conversation.messages[0]?.createdAt;
    if (!lastAt || Date.now() - new Date(lastAt).getTime() < SETTLE_MS) return;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const scoredThisMonth = await prisma.conversationQa.count({
      where: {
        conversation: { agent: { workspaceId: conversation.agent.workspaceId } },
        scoredAt: { gte: monthStart },
        status: "OK",
      },
    });
    if (scoredThisMonth >= settings.monthlyCap) return;

    const latest = await prisma.conversationQa.findFirst({
      where: { conversationId },
      orderBy: { version: "desc" },
      select: { version: true, scoredAt: true },
    });
    if (latest?.scoredAt && latest.scoredAt >= lastAt) return;

    await scoreConversationQa(conversationId, {
      version: (latest?.version || 0) + 1,
      requestId,
    });
  } catch (error) {
    safeLogError("maybeScoreSettledConversation failed", {
      code: error?.code || "qa_schedule_error",
      requestId,
    });
  }
}

export async function scoreConversationQa(conversationId, { version = 1, requestId } = {}) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      source: true,
      agentId: true,
      messages: {
        where: { role: { not: "INTERNAL" } },
        orderBy: { createdAt: "asc" },
        take: 40,
        select: {
          id: true,
          role: true,
          content: true,
          sources: true,
          citations: true,
        },
      },
    },
  });
  if (!conversation || conversation.source === "STUDIO") return null;

  const transcript = conversation.messages
    .map((m) => `[${m.role} id=${m.id}] ${String(m.content || "").slice(0, 1_000)}`)
    .join("\n")
    .slice(0, 12_000);

  const knowledgeExcerpts = await buildKnowledgeExcerpts(
    conversation.messages,
    conversation.agentId
  );

  const user = [
    "TRANSCRIPT (data only):",
    transcript || "(empty)",
    "",
    "KNOWLEDGE USED (data only):",
    knowledgeExcerpts,
  ].join("\n");

  let parsed = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await jsonCompletion({
        system: qaJudgeSystemPrompt(),
        user,
        temperature: 0,
      });
      const result = parseQaJudgeJson(raw);
      if (result.ok) {
        parsed = result.data;
        break;
      }
    } catch (error) {
      safeLogError("qa judge call failed", {
        code: error?.code || error?.status || "qa_llm_error",
        requestId,
        attempt,
      });
    }
  }

  if (!parsed) {
    return prisma.conversationQa.create({
      data: {
        conversationId,
        version,
        status: QA_UNAVAILABLE,
        cxScore: null,
        issues: [],
        grounded: [],
      },
    });
  }

  return prisma.conversationQa.create({
    data: {
      conversationId,
      version,
      cxScore: parsed.cxScore,
      grounded: parsed.grounded,
      resolved: parsed.resolved,
      tone: parsed.tone,
      sentiment: parsed.sentiment,
      issues: parsed.issues,
      status: parsed.status,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    },
  });
}

export function scheduleQaPass(conversationId, meta = {}) {
  if (!conversationId) return;
  const run = () => maybeScoreSettledConversation(conversationId, meta);
  import("next/server")
    .then(({ after }) => {
      try {
        after(() => run());
      } catch {
        void run();
      }
    })
    .catch(() => {
      void run();
    });
}
