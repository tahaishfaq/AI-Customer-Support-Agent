/**
 * Source ambiguity clarify — when inventory asks could be GitHub MCP and/or web.
 * Knowledge typo clarify stays in knowledge-retrieve.js.
 * DATA != AUTHORITY: this only picks a source preference; tools still go through PEP.
 */

import { isAffirmativeReply } from "@/lib/services/ai/knowledge-retrieve";

const SOURCE_CLARIFY_MARKER = "Where should I look";

/**
 * @param {string} utterance
 * @returns {{ explicitGithub: boolean, inventoryAsk: boolean, explicitWeb: boolean }}
 */
export function detectSourceAskSignals(utterance) {
  const t = String(utterance || "").toLowerCase();
  const explicitGithub =
    /\bgit[\s-]*hubs?\b/.test(t) ||
    /\bgtihub\b/.test(t) ||
    /\bgithb\b/.test(t);
  const explicitWeb =
    /\b(search\s+on\s+(the\s+)?(web|internet)|search\s+the\s+(web|internet|online)|look\s+up\s+online|from\s+the\s+web|on\s+the\s+(web|internet)|web\s+search)\b/.test(
      t
    ) || /\b(online|internet)\b/.test(t);
  const inventoryAsk =
    /\b(repositor(?:y|ies)|repos?)\b/.test(t) ||
    /\b(pull[- ]?requests?|\bprs\b)\b/.test(t) ||
    /\b(commits?|issues?)\b/.test(t) ||
    (/\b(get|show|fetch|list)\b/.test(t) &&
      /\b(profile|user)\b/.test(t)) ||
    /\b(search|list|find|show|get|fetch)\b[\s\w-]{0,40}\b(repos?|repositor(?:y|ies)|commits?|issues?|pull[- ]?requests?|prs|users?)\b/.test(
      t
    );
  return { explicitGithub, inventoryAsk, explicitWeb };
}

/**
 * Confirmation / capability ask — "do you have access?" — not live inventory.
 * Inventory verbs win: "can you list my repos" stays an inventory ask.
 * @param {string} utterance
 */
export function detectCapabilityAsk(utterance) {
  const t = String(utterance || "").toLowerCase();
  if (!t.trim()) return false;
  const { inventoryAsk, explicitGithub } = detectSourceAskSignals(t);
  if (inventoryAsk) return false;

  const capabilityPhrase =
    /\b(do you (have|got)|did you (have|got)|have you (got|have)|can you (access|use|connect|reach)|are you connected|do you support|have access|got access|access to|connected to)\b/.test(
      t
    ) ||
    /\b(is|are)\s+(github|git[\s-]*hub)\s+(available|connected|enabled|configured|linked)\b/.test(
      t
    ) ||
    /\b(github|git[\s-]*hub|gtihub|githb).{0,48}\b(access|connected|available|enabled|configured)\b/.test(
      t
    ) ||
    /\b(access|connected|available|enabled|configured).{0,48}\b(github|git[\s-]*hub|gtihub|githb)\b/.test(
      t
    );

  if (!capabilityPhrase) return false;
  // Require a platform/tool cue so generic "do you have access?" stays open.
  return (
    explicitGithub ||
    /\b(tools?|mcp|integrations?|connectors?|oauth)\b/.test(t)
  );
}

/**
 * @param {{
 *   utterance: string,
 *   hasGithubMcp?: boolean,
 *   webSearchEnabled?: boolean,
 *   hasKnowledgeHit?: boolean,
 *   stickyPreference?: 'github'|'web'|'knowledge'|null,
 * }} opts
 * @returns {null | { options: Array<'github'|'web'|'knowledge'>, reason: string }}
 */
export function detectSourceAmbiguity(opts = {}) {
  const utterance = String(opts.utterance || "");
  const { explicitGithub, inventoryAsk, explicitWeb } =
    detectSourceAskSignals(utterance);
  if (!inventoryAsk) return null;
  if (explicitGithub || explicitWeb) return null;

  const sticky = opts.stickyPreference;
  if (sticky === "github" || sticky === "web" || sticky === "knowledge") {
    return null;
  }

  const hasGithubMcp = Boolean(opts.hasGithubMcp);
  const webOn = Boolean(opts.webSearchEnabled);
  const hasKnowledge = Boolean(opts.hasKnowledgeHit);

  const options = [];
  if (hasGithubMcp) options.push("github");
  if (webOn) options.push("web");
  if (hasKnowledge) options.push("knowledge");

  // Need at least two real choices to bother the user.
  if (options.length < 2) return null;

  return {
    options,
    reason: "inventory_source_ambiguous",
  };
}

/**
 * In-thread sticky source from recent chat text (no tool payloads / no schema).
 * Newest-first. Skips the in-flight user utterance and clarify picker prompts.
 * @param {{ role?: string, content?: string }[]} recentMessagesDesc
 * @param {{ currentUtterance?: string, limit?: number }} [opts]
 * @returns {'github'|'web'|'knowledge'|null}
 */
export function inferStickySourcePreference(recentMessagesDesc = [], opts = {}) {
  const current = String(opts.currentUtterance || "")
    .trim()
    .toLowerCase();
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 40);
  const msgs = Array.isArray(recentMessagesDesc)
    ? recentMessagesDesc.slice(0, limit)
    : [];

  for (const m of msgs) {
    const role = String(m?.role || "").toUpperCase();
    const content = String(m?.content || "");
    const contentNorm = content.trim().toLowerCase();
    if (!contentNorm) continue;

    if (role === "USER") {
      if (current && contentNorm === current) continue;
      const sig = detectSourceAskSignals(content);
      if (sig.explicitGithub) return "github";
      if (sig.explicitWeb) return "web";
      // Prior clarify chip / short preference reply (not an inventory ask).
      if (!sig.inventoryAsk) {
        if (
          /\b(connected\s+)?github\b/.test(contentNorm) ||
          /\bmcp\b/.test(contentNorm)
        ) {
          return "github";
        }
        if (
          /\bweb(\s+search)?\b/.test(contentNorm) ||
          (/\bonline\b/.test(contentNorm) && !sig.explicitGithub)
        ) {
          return "web";
        }
        if (
          /\bknowledge\b/.test(contentNorm) ||
          /\bknowledge only\b/.test(contentNorm)
        ) {
          return "knowledge";
        }
      }
      continue;
    }

    if (role === "ASSISTANT") {
      if (isSourceClarifyAssistantMessage(content)) continue;
      if (
        /sources:\s*connected\s+github/i.test(content) ||
        /\bconnected\s+github\b/i.test(content)
      ) {
        return "github";
      }
      if (/sources:\s*(online|web)/i.test(content)) {
        return "web";
      }
      const sig = detectSourceAskSignals(content);
      if (sig.explicitGithub) return "github";
      if (sig.explicitWeb) return "web";
    }
  }

  return null;
}

/**
 * @param {Array<'github'|'web'|'knowledge'>} options
 */
export function formatSourceClarifyQuestion(options = []) {
  const list = Array.isArray(options) ? options : [];
  if (!list.length) return "";

  const labels = {
    github:
      "**Connected GitHub** — use your linked GitHub tools (profile, repos, issues)",
    web: "**Web search** — look this up on the public internet",
    knowledge:
      "**Knowledge only** — answer from this agent’s saved docs (no live tools)",
  };

  const lines = [
    `${SOURCE_CLARIFY_MARKER}? I do not want to guess.`,
    "",
  ];
  let n = 0;
  for (const key of list) {
    if (!labels[key]) continue;
    n += 1;
    lines.push(`${n}. ${labels[key]}`);
  }
  lines.push("");
  lines.push(
    "Reply with a number (1, 2, …) or the option name (for example Connected GitHub)."
  );
  return lines.join("\n");
}

export const SOURCE_CLARIFY_OPTION_LABELS = Object.freeze({
  github: "Connected GitHub",
  web: "Web search",
  knowledge: "Knowledge only",
});

/** Ordered source keys as shown in a clarify assistant message. */
export function sourceOptionsFromClarifyContent(content) {
  const ordered = [];
  for (const line of String(content || "").split("\n")) {
    if (/\*\*Connected GitHub\*\*/i.test(line)) ordered.push("github");
    else if (/\*\*Web search\*\*/i.test(line)) ordered.push("web");
    else if (/\*\*Knowledge only\*\*/i.test(line)) ordered.push("knowledge");
  }
  return ordered;
}

/** Clickable clarify chips (label text resolves via resolveSourceClarifyReply). */
export function sourceClarifyButtonsFromContent(content) {
  return sourceOptionsFromClarifyContent(content).map((key, i) => ({
    key,
    n: i + 1,
    label: SOURCE_CLARIFY_OPTION_LABELS[key] || key,
  }));
}

export function isSourceClarifyAssistantMessage(content) {
  return new RegExp(SOURCE_CLARIFY_MARKER, "i").test(String(content || ""));
}

/**
 * @param {string} message
 * @param {{ role: string, content: string }[]} recentMessagesDesc newest-first
 * @returns {null | { preference: 'github'|'web'|'knowledge', priorAsk: string, rewritten: string }}
 */
export function resolveSourceClarifyReply(message, recentMessagesDesc = []) {
  const raw = String(message || "").trim();
  if (!raw) return null;

  const msgs = Array.isArray(recentMessagesDesc) ? recentMessagesDesc : [];
  let clarifyIdx = -1;
  for (let i = 0; i < msgs.length; i += 1) {
    const role = String(msgs[i]?.role || "").toUpperCase();
    if (role !== "ASSISTANT") continue;
    if (!isSourceClarifyAssistantMessage(msgs[i]?.content)) continue;
    clarifyIdx = i;
    break;
  }
  if (clarifyIdx < 0) return null;

  const clarifyContent = msgs[clarifyIdx]?.content || "";
  const ordered = sourceOptionsFromClarifyContent(clarifyContent);
  const t = raw.toLowerCase().replace(/[.!?]+$/g, "");
  let preference = null;

  const numMatch =
    t.match(/^(?:option|choice|#)?\s*([1-9]\d*)\b/) ||
    t.match(/\b(?:option|choice)\s*([1-9]\d*)\b/);
  if (numMatch) {
    const idx = Number(numMatch[1]) - 1;
    if (idx >= 0 && idx < ordered.length) {
      preference = ordered[idx];
    }
  }

  if (!preference) {
    if (
      /\b(connected\s+)?github\b/.test(t) ||
      /\bmcp\b/.test(t) ||
      /\b(my\s+)?(profile|tools?)\b/.test(t)
    ) {
      preference = "github";
    } else if (
      /\bweb(\s+search)?\b/.test(t) ||
      /\bonline\b/.test(t) ||
      /\binternet\b/.test(t)
    ) {
      preference = "web";
    } else if (
      /\bknowledge\b/.test(t) ||
      /\bdocs?\b/.test(t) ||
      /\bfaq\b/.test(t) ||
      /\bsaved\b/.test(t)
    ) {
      preference = "knowledge";
    } else if (isAffirmativeReply(t)) {
      // Ambiguous yes — do not guess a source.
      return null;
    } else {
      return null;
    }
  }

  let priorAsk = "";
  for (let i = clarifyIdx + 1; i < msgs.length; i += 1) {
    if (String(msgs[i]?.role || "").toUpperCase() === "USER") {
      priorAsk = String(msgs[i]?.content || "").trim();
      break;
    }
  }
  if (!priorAsk) priorAsk = raw;

  let rewritten = priorAsk;
  if (preference === "github") {
    rewritten = `${priorAsk} (from connected GitHub)`;
  } else if (preference === "web") {
    rewritten = `${priorAsk} (search the web)`;
  } else if (preference === "knowledge") {
    rewritten = `${priorAsk} (from agent knowledge only)`;
  }

  return { preference, priorAsk, rewritten };
}

/**
 * Knowledge-first: keep tools only when the user clearly needs live data.
 * @param {Array} actions
 * @param {{ usedKnowledgeCount: number, wantsGithub: boolean, mayInvokeWebSearch: boolean, wantsWeb: boolean, forceKnowledgeOnly?: boolean }} opts
 */
export function filterActionsKnowledgeFirst(actions, opts = {}) {
  const list = Array.isArray(actions) ? actions : [];
  if (opts.forceKnowledgeOnly) {
    return list.filter((a) => {
      const name = String(a?.name || "").toLowerCase();
      return name === "request_handoff" || a?._builtin?.id === "request_handoff";
    });
  }
  const used = Number(opts.usedKnowledgeCount) || 0;
  const liveAsk =
    Boolean(opts.wantsGithub) ||
    Boolean(opts.mayInvokeWebSearch) ||
    Boolean(opts.wantsWeb);
  if (used > 0 && !liveAsk) {
    return list.filter((a) => {
      const name = String(a?.name || "").toLowerCase();
      return (
        name === "request_handoff" ||
        name === "web_search" ||
        a?._builtin?.id === "request_handoff" ||
        a?._builtin?.id === "web_search"
      );
    }).filter((a) => {
      // Drop web_search when route forbids it — caller may pass mayInvoke false.
      if (!opts.mayInvokeWebSearch) {
        const name = String(a?.name || "").toLowerCase();
        return name !== "web_search" && a?._builtin?.id !== "web_search";
      }
      return true;
    });
  }
  return list;
}
