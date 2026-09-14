/**
 * Stage 3 P0-3 + Stage 5.5 — Deterministic source router + store-integrity PEP.
 *
 * Canonical turn routes: STORE | WEB | GENERAL | MIXED
 * Prompt text is defense-in-depth; web_search is gated by mayInvokeWebSearch /
 * filterCapabilitiesForSourceRoute (tools stripped before the LLM sees them).
 */

export const RESPONSE_RULES_STORE_FACTS = [
  "STORE FACTS (hard rule): For this business’s products, prices, stock, inventory, availability, order status, shipping ETA, refunds, tickets, or account records — answer ONLY from Agent knowledge and/or tool results from this agent’s configured store/API tools.",
  "Never invent store availability or prices from general/public model knowledge.",
  "If store/knowledge/tools return nothing: say you cannot verify / not found in this store. Do NOT claim the product is available or quote a store price from memory.",
  "Online/web information is separate: only use the web_search tool when the user explicitly asks for internet/online/current public info or a comparison. Label it as Online/web — never as Your store.",
  "When comparing store vs online: keep two clearly labeled sections (Your store vs Online).",
].join(" ");

/** Canonical Stage 5.5 routes. */
export const SOURCE_ROUTES = Object.freeze({
  STORE: "STORE",
  WEB: "WEB",
  GENERAL: "GENERAL",
  MIXED: "MIXED",
});

/**
 * Detect signal bags (deterministic, order-independent).
 * @param {string} t lowercased utterance
 */
function detectSourceSignals(t) {
  const wantsWeb =
    /\b(search\s+(?:on\s+)?(?:the\s+)?(?:web|internet|online)|google|look (it )?up online|look online|on the internet|from the (web|internet)|browse (the )?(web|internet))\b/.test(
      t
    ) ||
    /\bonline\b.*\b(price|available|availability|news|headline|current)\b/.test(t) ||
    /\b(current (news|events|headlines)|today'?s news)\b/.test(t) ||
    /\b(web search|internet search)\b/.test(t);

  const storeFact =
    /\b(price|cost|in stock|stock|available|availability|inventory|order|shipping|refund|ticket|sku|cart|checkout|booking|reservation|membership|subscription)\b/.test(
      t
    ) ||
    /\b(do you (have|sell|carry)|have you got|is .+ available|carry .+)\b/.test(t) ||
    /\b(my|your|this|the)\s+store\b/.test(t) ||
    /\b(order status|tracking number|ship(ping)? eta)\b/.test(t);

  const wantsCompare =
    /\b(compare|vs\.?|versus|difference between)\b/.test(t) &&
    (/\b(store|your|online|web|internet)\b/.test(t) || wantsWeb);

  const generalAsk =
    /\b(what is|what'?s|who is|who'?s|how (does|do|can|to)|explain|define|why (is|are|do|does)|tell me about)\b/.test(
      t
    ) && !storeFact;

  return { wantsWeb, storeFact, wantsCompare, generalAsk };
}

/**
 * Classify coarse source intent for routing / logging (deterministic heuristics).
 * Legacy labels kept for Stage 3/4 harnesses (PUBLIC_KNOWLEDGE ≡ GENERAL route).
 * @param {string} utterance
 * @returns {"STORE_FACT"|"WEB_REQUEST"|"MIXED"|"PUBLIC_KNOWLEDGE"|"OTHER"}
 */
export function classifySourceIntent(utterance) {
  const t = String(utterance || "").toLowerCase();
  if (!t.trim()) return "OTHER";

  const { wantsWeb, storeFact, wantsCompare } = detectSourceSignals(t);

  if (wantsCompare) return "MIXED";
  if (wantsWeb && storeFact) return "MIXED";
  if (wantsWeb) return "WEB_REQUEST";
  if (storeFact) return "STORE_FACT";
  return "PUBLIC_KNOWLEDGE";
}

/**
 * Stage 5.5 — canonical deterministic source route for a turn.
 * @param {string|null|undefined} utterance
 * @param {{ webSearchEnabled?: boolean }} [opts]
 * @returns {{
 *   route: "STORE"|"WEB"|"GENERAL"|"MIXED",
 *   intent: string,
 *   mayInvokeWebSearch: boolean,
 *   allowParametricKnowledge: boolean,
 *   preferAgentKnowledge: boolean,
 *   signals: { wantsWeb: boolean, storeFact: boolean, wantsCompare: boolean, generalAsk: boolean },
 * }}
 */
export function routeSource(utterance, opts = {}) {
  const t = String(utterance || "").toLowerCase();
  const signals = t.trim()
    ? detectSourceSignals(t)
    : {
        wantsWeb: false,
        storeFact: false,
        wantsCompare: false,
        generalAsk: false,
      };
  const intent = classifySourceIntent(utterance);

  /** @type {"STORE"|"WEB"|"GENERAL"|"MIXED"} */
  let route = SOURCE_ROUTES.GENERAL;
  if (intent === "STORE_FACT") route = SOURCE_ROUTES.STORE;
  else if (intent === "WEB_REQUEST") route = SOURCE_ROUTES.WEB;
  else if (intent === "MIXED") route = SOURCE_ROUTES.MIXED;
  else route = SOURCE_ROUTES.GENERAL;

  const webFlagOn = opts.webSearchEnabled !== false;
  const mayWeb =
    webFlagOn &&
    (route === SOURCE_ROUTES.WEB || route === SOURCE_ROUTES.MIXED);

  return {
    route,
    intent,
    mayInvokeWebSearch: mayWeb,
    allowParametricKnowledge: route !== SOURCE_ROUTES.STORE,
    preferAgentKnowledge:
      route === SOURCE_ROUTES.STORE || route === SOURCE_ROUTES.MIXED,
    signals,
  };
}

/**
 * Server PEP for the web_search builtin — LLM cannot authorize web for store-only asks.
 * @param {string|null|undefined} utterance
 */
export function mayInvokeWebSearch(utterance) {
  return routeSource(utterance).mayInvokeWebSearch;
}

/**
 * Required answer source family for the turn (for logs / Stage 3–4 tests).
 * PUBLIC kept for harness compat; prefer routeSource().route (GENERAL) in new code.
 * @param {string|null|undefined} utterance
 * @returns {"STORE"|"WEB"|"MIXED"|"PUBLIC"|"OTHER"}
 */
export function requiredSourceFamily(utterance) {
  const intent = classifySourceIntent(utterance);
  if (intent === "STORE_FACT") return "STORE";
  if (intent === "WEB_REQUEST") return "WEB";
  if (intent === "MIXED") return "MIXED";
  if (intent === "PUBLIC_KNOWLEDGE") return "PUBLIC";
  return "OTHER";
}

/**
 * Strip web_search when the route forbids live web.
 * Stage 5.8 — also strip WRITE/DESTRUCTIVE on GENERAL/WEB (no mutate on conceptual/online asks).
 * @param {Array<{ name?: string, riskLevel?: string }>} capabilities
 * @param {{ mayInvokeWebSearch?: boolean, route?: string }|null|undefined} decision
 */
export function filterCapabilitiesForSourceRoute(capabilities, decision) {
  const list = Array.isArray(capabilities) ? capabilities : [];
  if (!decision) return list;
  const route = decision.route;
  const stripWrites = route === SOURCE_ROUTES.GENERAL || route === SOURCE_ROUTES.WEB;
  return list.filter((c) => {
    const n = String(c?.name || "").toLowerCase();
    if (
      !decision.mayInvokeWebSearch &&
      (n === "web_search" || n === "websearch")
    ) {
      return false;
    }
    if (stripWrites) {
      const risk = String(c?.riskLevel || "READ").toUpperCase();
      if (risk === "WRITE" || risk === "DESTRUCTIVE") return false;
    }
    return true;
  });
}

/**
 * Turn-level system addon — reinforces route without replacing global STORE FACTS.
 * @param {{ route: string, allowParametricKnowledge?: boolean }} decision
 */
export function sourceRouteSystemAddon(decision) {
  if (!decision?.route) return "";
  const route = decision.route;
  if (route === SOURCE_ROUTES.STORE) {
    return [
      "## Source route (server): STORE",
      "This turn is a store-fact ask. Use Agent knowledge and/or this agent’s store/API tools only.",
      "Do not invent prices, stock, or order data from general model knowledge.",
      "Do not call web_search.",
    ].join(" ");
  }
  if (route === SOURCE_ROUTES.WEB) {
    return [
      "## Source route (server): WEB",
      "The user asked for online/internet information. You may use web_search when available.",
      "Label online results as Online/web — never as Your store.",
    ].join(" ");
  }
  if (route === SOURCE_ROUTES.MIXED) {
    return [
      "## Source route (server): MIXED",
      "Keep two clearly labeled sections: Your store (knowledge/tools only) vs Online (web_search).",
      "Never blend online prices into store facts.",
    ].join(" ");
  }
  return [
    "## Source route (server): GENERAL",
    "General / public knowledge is allowed — answer conceptual questions (definitions, explanations) helpfully from general knowledge.",
    "Still never invent this business’s private store facts (prices, stock, orders, private policies).",
  ].join(" ");
}

/**
 * Append source-route directive to an existing system prompt.
 * @param {string} system
 * @param {ReturnType<typeof routeSource>} decision
 */
export function applySourceRouteToSystem(system, decision) {
  const addon = sourceRouteSystemAddon(decision);
  if (!addon) return String(system || "");
  return `${String(system || "").trim()}\n\n${addon}`;
}
