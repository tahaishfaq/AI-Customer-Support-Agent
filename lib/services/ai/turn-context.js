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
  capabilityAskSystemAddon,
  filterCapabilitiesForSourceRoute,
  isGithubMcpAction,
  routeSource,
} from "@/lib/services/ai/source-policy";
import {
  detectSourceAmbiguity,
  detectSourceAskSignals,
  filterActionsKnowledgeFirst,
  formatSourceClarifyQuestion,
  inferStickySourcePreference,
  resolveSourceClarifyReply,
} from "@/lib/services/ai/intent-clarify";
import {
  decidePublicEvidence,
  isSuppressiblePublicRead,
} from "@/lib/services/ai/public-evidence";
import { buildKnowledgeEvidence } from "@/lib/services/ai/evidence-bundle";
import { isRecrawlDue } from "@/lib/services/crawl-schedule";
import { isHostedWebSearchAllowed } from "@/lib/services/ai/web-search-config";
import { listEnabledActionsForAgent } from "@/lib/actions/tool-loop";
import { toolsPromptAddon } from "@/lib/actions/tool-definitions";
import { relevantToolNames, shortlistToolsForTurn } from "@/lib/services/ai/tool-shortlist";
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

  const sourceResolved = resolveSourceClarifyReply(
    contentForLlm(effectiveMessage),
    recentMessages
  );
  const routeUtterance = sourceResolved?.rewritten || effectiveMessage;
  const retrieveQuery = resolveRetrieveQuery(
    contentForLlm(routeUtterance),
    recentMessages
  );

  const webSearchLive = isHostedWebSearchAllowed({
    agentEnabled: agent.webSearchEnabled,
  });
  let sourceDecision = routeSource(routeUtterance, {
    webSearchEnabled: webSearchLive,
  });
  if (sourceResolved?.preference === "web") {
    sourceDecision = {
      ...sourceDecision,
      route: "WEB",
      mayInvokeWebSearch: webSearchLive,
      preferAgentKnowledge: false,
      signals: {
        ...sourceDecision.signals,
        wantsWeb: true,
        wantsGithub: false,
        capabilityAsk: false,
      },
    };
  } else if (sourceResolved?.preference === "github") {
    sourceDecision = {
      ...sourceDecision,
      route: "GENERAL",
      mayInvokeWebSearch: false,
      preferAgentKnowledge: false,
      signals: {
        ...sourceDecision.signals,
        wantsGithub: true,
        wantsWeb: false,
        capabilityAsk: false,
      },
    };
  } else if (sourceResolved?.preference === "knowledge") {
    sourceDecision = {
      ...sourceDecision,
      preferAgentKnowledge: true,
      mayInvokeWebSearch: false,
      signals: {
        ...sourceDecision.signals,
        wantsGithub: false,
        wantsWeb: false,
        capabilityAsk: false,
      },
    };
  } else {
    // Follow-up inventory without "github" in the text — reuse in-thread sticky source.
    const sticky = inferStickySourcePreference(recentMessages, {
      currentUtterance: contentForLlm(effectiveMessage),
    });
    const { inventoryAsk } = detectSourceAskSignals(effectiveMessage);
    if (sticky === "github" && inventoryAsk) {
      sourceDecision = {
        ...sourceDecision,
        route: "GENERAL",
        mayInvokeWebSearch: false,
        preferAgentKnowledge: false,
        signals: {
          ...sourceDecision.signals,
          wantsGithub: true,
          wantsWeb: false,
          capabilityAsk: false,
        },
      };
    } else if (sticky === "web" && inventoryAsk) {
      sourceDecision = {
        ...sourceDecision,
        route: "WEB",
        mayInvokeWebSearch: webSearchLive,
        preferAgentKnowledge: false,
        signals: {
          ...sourceDecision.signals,
          wantsWeb: true,
          wantsGithub: false,
          capabilityAsk: false,
        },
      };
    }
  }

  // Soft-fallback newest chunks only when store-style knowledge is preferred.
  // GitHub / GENERAL inventory asks must not paint unrelated Brandly docs.
  const allowSoftFallback =
    Boolean(sourceDecision.preferAgentKnowledge) &&
    !sourceDecision.signals?.wantsGithub &&
    !sourceDecision.signals?.capabilityAsk &&
    sourceResolved?.preference !== "web";

  /** Short greetings should not wait on full knowledge scoring. */
  const utteranceTrim = String(contentForLlm(effectiveMessage) || "").trim();
  const isTrivialGreeting =
    utteranceTrim.length > 0 &&
    utteranceTrim.length <= 48 &&
    /^(hi|hii+|hello|hey|yo|hola|salam|assalamu?\s*alaikum|good\s*(morning|afternoon|evening)|howdy|sup|what's\s*up|whats\s*up)[\s!.?]*$/i.test(
      utteranceTrim
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
        label: "Checking knowledge",
        route: sourceDecision.route,
        stepIndex: 0,
        ...extra,
      },
    });
  };

  let selected = {
    text: "",
    used: [],
    clarify: [],
  };
  if (!isTrivialGreeting && knowledgeDocs.length) {
    emitKnowledge("running");
    selected = selectKnowledgeChunks({
      docs: knowledgeDocs,
      query: retrieveQuery,
      maxChars: MAX_KNOWLEDGE_CHARS,
      siteKnowledgeOrigin: agent.siteKnowledgeOrigin || null,
      recentMessages,
      allowSoftFallback,
    });
    emitKnowledge("completed", {
      ...(!selected.used?.length ? { outcome: "no_result" } : {}),
    });
  }

  const knowledgeText = selected.text;
  const usedKnowledge = selected.used;
  const knowledgeEvidence = buildKnowledgeEvidence({
    used: usedKnowledge,
    docs: knowledgeDocs,
    route: sourceDecision.route,
    crawlStatus: latestCrawlJob?.status || null,
    crawlStale: isRecrawlDue(agent),
  });
  const clarify = selected.clarify || [];

  const hasGithubMcp = enabledActions.some(
    (a) =>
      Boolean(a?._mcp) &&
      /github/i.test(String(a?.name || ""))
  );
  const stickyPreference = inferStickySourcePreference(recentMessages, {
    currentUtterance: contentForLlm(effectiveMessage),
  });
  const ambiguity = detectSourceAmbiguity({
    utterance: effectiveMessage,
    hasGithubMcp,
    webSearchEnabled: webSearchLive,
    hasKnowledgeHit: usedKnowledge.length > 0,
    stickyPreference,
  });
  // Skip source clarify when user already answered a prior source picker.
  const sourceClarify =
    !sourceResolved && ambiguity
      ? {
          options: ambiguity.options,
          question: formatSourceClarifyQuestion(ambiguity.options),
          reason: ambiguity.reason,
        }
      : null;

  const replyLanguage = detectKnowledgeLanguage(knowledgeDocs);
  const publicEvidence = decidePublicEvidence({
    query: routeUtterance,
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

  let offeredActions = filterActionsKnowledgeFirst(enabledActions, {
    usedKnowledgeCount: usedKnowledge.length,
    wantsGithub: Boolean(sourceDecision.signals?.wantsGithub),
    mayInvokeWebSearch: Boolean(sourceDecision.mayInvokeWebSearch),
    wantsWeb: Boolean(sourceDecision.signals?.wantsWeb),
    forceKnowledgeOnly: sourceResolved?.preference === "knowledge",
  });
  // Capability confirmations answer from config — never offer live GitHub MCP this turn.
  const capabilityAsk = Boolean(sourceDecision.signals?.capabilityAsk);
  const githubMcpConfigured = enabledActions.filter(isGithubMcpAction);
  if (capabilityAsk) {
    offeredActions = offeredActions.filter((a) => !isGithubMcpAction(a));
  }
  // Only question-relevant MCP tools (capped), none from a server whose credential failed.
  offeredActions = shortlistToolsForTurn(offeredActions, {
    utterance: contentForLlm(routeUtterance),
    wantsGithub: Boolean(sourceDecision.signals?.wantsGithub),
  });
  let offeredDescriptors = filterCapabilitiesForSourceRoute(
    enabledDescriptors,
    sourceDecision,
    { suppressedNames: suppressedPublicReadNames }
  );
  offeredDescriptors = offeredDescriptors.filter((d) =>
    offeredActions.some((a) => a.name === d.name)
  );
  // Source clarify turn: do not run tools yet.
  if (sourceClarify) {
    offeredActions = [];
    offeredDescriptors = [];
  }

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
    if (capabilityAsk) {
      systemPrompt = `${systemPrompt}\n\n${capabilityAskSystemAddon({
        platform: "GitHub",
        connected: githubMcpConfigured.length > 0,
        toolNames: githubMcpConfigured.map((a) => a.name),
      })}`;
    }
    const offeredForPrompt = filterCapabilitiesForSourceRoute(
      offeredActions,
      sourceDecision,
      { suppressedNames: suppressedPublicReadNames }
    );
    const toolsAddon = toolsPromptAddon(offeredForPrompt.map((a) => a.name));
    if (toolsAddon) {
      systemPrompt = `${systemPrompt}\n\n${toolsAddon}`;
    }
    const matchingTools =
      sourceDecision.route === "WEB" ? [] : relevantToolNames(offeredForPrompt, contentForLlm(routeUtterance));
    if (matchingTools.length && !capabilityAsk) {
      systemPrompt = `${systemPrompt}\n\n## Relevant tools (server)\nConnected tools that match this question: ${matchingTools.join(", ")}. If one fits, call it before answering. If it returns nothing relevant, say you couldn't find that and offer to connect the customer with the team — do not fill the gap from general knowledge.`;
    }
    if (
      (sourceDecision.route === "STORE" || sourceDecision.route === "MIXED") &&
      !usedKnowledge.length
    ) {
      systemPrompt = `${systemPrompt}\n\n## Evidence for this turn (server)\nAgent knowledge has no content matching this question${knowledgeDocs.length ? "" : " (this agent has no knowledge documents yet)"}. Answer business facts (policies, prices, plans, orders) only from a tool result in this turn. If no tool provides it, say plainly that you can't confirm it here and offer to connect the customer with the team. Never describe what such policies or prices typically or usually are.`;
    }
    if (sourceResolved?.preference === "github") {
      systemPrompt = `${systemPrompt}\n\n## Source preference (server)\nThe visitor chose Connected GitHub. Call an enabled GitHub MCP tool before answering. Do not use web_search.`;
    }
    if (sourceResolved?.preference === "web") {
      systemPrompt = `${systemPrompt}\n\n## Source preference (server)\nThe visitor chose Web search. Use web_search when available. Do not invent live results.`;
    }
    if (sourceResolved?.preference === "knowledge") {
      systemPrompt = `${systemPrompt}\n\n## Source preference (server)\nThe visitor chose Knowledge only. Answer from Agent knowledge. Do not call live tools.`;
    }
  } catch (err) {
    safeLogError("prompt-builder failed", {
      agentId,
      message: err?.message,
    });
    throw httpError(500, "Could not build agent prompt");
  }

  return {
    effectiveMessage: routeUtterance,
    retrieveQuery,
    recentMessages,
    llmMessages,
    knowledgeDocs,
    knowledgeText,
    usedKnowledge,
    knowledgeEvidence,
    clarify,
    sourceClarify,
    sourceResolved,
    deskNotesText,
    enabledActions: offeredActions,
    enabledDescriptors: offeredDescriptors,
    actionsWorkspaceId,
    latestCrawlJob,
    replyLanguage,
    sourceDecision,
    publicEvidence,
    suppressedPublicReadNames,
    systemPrompt,
  };
}
