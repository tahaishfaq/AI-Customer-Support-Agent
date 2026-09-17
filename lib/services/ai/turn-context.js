/**
 * Trusted agent turn context builder.
 * Assembles history, knowledge, source route, capabilities, and system prompt
 * before orchestrator.runTurn — DATA != AUTHORITY; no LLM input here.
 */

import prisma from "@/lib/prisma";
import {
  MAX_KNOWLEDGE_CHARS,
  resolveRetrieveQuery,
  selectKnowledgeChunks,
} from "@/lib/services/ai/knowledge-retrieve";
import {
  buildChatSystemPrompt,
  formatDeskNotesForPrompt,
} from "@/lib/services/ai/prompt-builder";
import {
  applySourceRouteToSystem,
  filterCapabilitiesForSourceRoute,
  routeSource,
} from "@/lib/services/ai/source-policy";
import {
  decidePublicEvidence,
  isSuppressiblePublicRead,
} from "@/lib/services/ai/public-evidence";
import { buildKnowledgeEvidence } from "@/lib/services/ai/evidence-bundle";
import { isRecrawlDue } from "@/lib/services/crawl-schedule";
import { isHostedWebSearchAllowed } from "@/lib/services/ai/web-search-config";
import { listEnabledActionsForAgent } from "@/lib/actions/tool-loop";
import { toolsPromptAddon } from "@/lib/actions/tool-definitions";
import { contentForLlm } from "@/lib/utils/chat-attachments";
import { safeLogError } from "@/lib/observability/safe-log";

export const MAX_HISTORY_MESSAGES = 20;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

/**
 * Prefer a single language across knowledge docs; mixed → english.
 * @param {Array<{ content?: string }>|null|undefined} docs
 */
export function detectKnowledgeLanguage(docs) {
  if (!docs?.length) return "english";

  const languages = new Set();
  for (const doc of docs) {
    languages.add(detectTextLanguage(doc.content || ""));
  }

  if (languages.size === 1) {
    return [...languages][0];
  }
  return "english";
}

export function detectTextLanguage(text) {
  const sample = String(text || "").slice(0, 4000);
  if (!sample.trim()) return "english";

  const arabicScript = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (sample.match(/[A-Za-z\u0600-\u06FF]/g) || []).length || 1;
  const arabicRatio = arabicScript / letters;

  if (arabicRatio >= 0.25) return "urdu";

  const lower = sample.toLowerCase();
  const romanUrduHits = (
    lower.match(
      /\b(hai|hain|kya|kyun|nahi|nahin|aap|ap|main|mein|kaise|karo|karna|madad|shukriya|theek|bilkul|please|ji|sahab|wala|wali)\b/g
    ) || []
  ).length;
  const words = (lower.match(/\b[a-z]{2,}\b/g) || []).length || 1;
  if (romanUrduHits / words >= 0.08 && romanUrduHits >= 4) return "roman_urdu";

  return "english";
}

/**
 * Load and assemble trusted turn inputs for runTurn.
 * Side effects are limited to DB reads; optional activity callback for streams.
 *
 * @param {{
 *   agent: object,
 *   conversationId: string,
 *   message?: string|null,
 *   onKnowledgeActivity?: (event: object) => void,
 * }} opts
 */
export async function buildAgentTurnContext({
  agent,
  conversationId,
  message = null,
  onKnowledgeActivity = null,
}) {
  if (!agent?.id || !conversationId) {
    throw httpError(500, "Turn context requires agent and conversation");
  }

  const agentId = agent.id;
  const [knowledgeDocs, recentMessages, deskNotes, actionRuntime, latestCrawlJob] =
    await Promise.all([
      prisma.knowledgeDocument.findMany({
        where: { agentId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          content: true,
          origin: true,
          sourceUrl: true,
          createdAt: true,
        },
      }),
      prisma.message.findMany({
        where: {
          conversationId,
          role: { not: "INTERNAL" },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_HISTORY_MESSAGES,
        select: { id: true, role: true, content: true },
      }),
      prisma.message.findMany({
        where: {
          conversationId,
          role: "INTERNAL",
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { content: true, createdAt: true },
      }),
      listEnabledActionsForAgent(agentId),
      agent.siteKnowledgeOrigin
        ? prisma.siteCrawlJob.findFirst({
            where: {
              agentId,
              origin: agent.siteKnowledgeOrigin,
            },
            orderBy: { createdAt: "desc" },
            select: { status: true },
          })
        : Promise.resolve(null),
    ]);

  const enabledActions = actionRuntime.actions || [];
  const enabledDescriptors = actionRuntime.descriptors || [];
  const actionsWorkspaceId =
    actionRuntime.workspaceId || agent.workspaceId || null;
  const deskNotesText = formatDeskNotesForPrompt(deskNotes);

  const effectiveMessage =
    message ||
    [...recentMessages].reverse().find((m) => m.role === "USER")?.content ||
    "";

  const historyAsc = [...recentMessages].reverse();
  const llmMessages = historyAsc.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: contentForLlm(m.content),
  }));

  const retrieveQuery = resolveRetrieveQuery(
    contentForLlm(effectiveMessage),
    recentMessages
  );

  const emitKnowledge = (phase, extra = {}) => {
    if (typeof onKnowledgeActivity !== "function" || !knowledgeDocs.length) {
      return;
    }
    onKnowledgeActivity({
      type: "tool",
      data: {
        kind: "agent_activity",
        activityId: "knowledge-selection",
        mode: "knowledge",
        phase,
        label: "Checking the knowledge base",
        route: routeSource(effectiveMessage).route,
        stepIndex: 0,
        ...extra,
      },
    });
  };

  emitKnowledge("running");
  const selected = selectKnowledgeChunks({
    docs: knowledgeDocs,
    query: retrieveQuery,
    maxChars: MAX_KNOWLEDGE_CHARS,
    siteKnowledgeOrigin: agent.siteKnowledgeOrigin || null,
    recentMessages,
  });
  emitKnowledge("completed", {
    ...(!selected.used?.length ? { outcome: "no_result" } : {}),
  });

  const knowledgeText = selected.text;
  const usedKnowledge = selected.used;
  const knowledgeEvidence = buildKnowledgeEvidence({
    used: usedKnowledge,
    docs: knowledgeDocs,
    route: routeSource(effectiveMessage).route,
    crawlStatus: latestCrawlJob?.status || null,
    crawlStale: isRecrawlDue(agent),
  });
  const clarify = selected.clarify || [];

  const replyLanguage = detectKnowledgeLanguage(knowledgeDocs);
  const webSearchLive = isHostedWebSearchAllowed({
    agentEnabled: agent.webSearchEnabled,
  });
  const sourceDecision = routeSource(effectiveMessage, {
    webSearchEnabled: webSearchLive,
  });
  const publicEvidence = decidePublicEvidence({
    query: effectiveMessage,
    route: sourceDecision.route,
    selectedUsed: usedKnowledge,
    knowledgeDocs,
    siteKnowledgeOrigin: agent.siteKnowledgeOrigin || null,
    crawlStatus: latestCrawlJob?.status || null,
    crawlStale: isRecrawlDue(agent),
  });
  const suppressedPublicReadNames = publicEvidence.sufficient
    ? new Set(
        enabledActions
          .filter(isSuppressiblePublicRead)
          .map((action) => action.name)
          .filter(Boolean)
      )
    : new Set();

  let systemPrompt;
  try {
    systemPrompt = buildChatSystemPrompt({
      agent,
      knowledgeText,
      deskNotesText,
      replyLanguage,
      answerStyle: agent.answerStyle,
      meta: { agentId: agent.id },
    });
    systemPrompt = applySourceRouteToSystem(systemPrompt, sourceDecision);
    const offeredForPrompt = filterCapabilitiesForSourceRoute(
      enabledActions,
      sourceDecision,
      { suppressedNames: suppressedPublicReadNames }
    );
    const toolsAddon = toolsPromptAddon(offeredForPrompt.map((a) => a.name));
    if (toolsAddon) {
      systemPrompt = `${systemPrompt}\n\n${toolsAddon}`;
    }
  } catch (err) {
    safeLogError("prompt-builder failed", {
      agentId,
      message: err?.message,
    });
    throw httpError(500, "Could not build agent prompt");
  }

  return {
    effectiveMessage,
    retrieveQuery,
    recentMessages,
    llmMessages,
    knowledgeDocs,
    knowledgeText,
    usedKnowledge,
    knowledgeEvidence,
    clarify,
    deskNotesText,
    enabledActions,
    enabledDescriptors,
    actionsWorkspaceId,
    latestCrawlJob,
    replyLanguage,
    sourceDecision,
    publicEvidence,
    suppressedPublicReadNames,
    systemPrompt,
  };
}
