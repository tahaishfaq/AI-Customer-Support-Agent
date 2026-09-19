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
    /\b(search\s+(?:on\s+)?(?:the\s+)?(?:web|internet|online)|google|look (it )?up online|look online|on the internet|from the (web|internet)|browse (the )?(web|internet)|online)\b/.test(
      t
    ) ||
    /\bonline\b.*\b(price|available|availability|news|headline|current)\b/.test(t) ||
    /\b(current (news|events|headlines)|today'?s news)\b/.test(t) ||
    /\b(web search|internet search)\b/.test(t);

  // Strong commerce/availability signals can pair with explicit web intent as MIXED.
  // Weaker tokens (support/feature/faq) still mark store asks, but alone must not
  // flip a pure online news/search request into MIXED.
  const strongStoreFact =
    /\b(price|prices|pricing|plan|plans|cost|in stock|stock|available|availability|inventory|order|shipping|refund|refunds|return|returns|policy|policies|warranty|delivery|ticket|sku|cart|checkout|booking|reservation|membership|subscription|cancellation|invoice|account|signup|sign[ -]?up|register|registration|tracking|track|workspace|workspaces|member|members|teammate|teammates|role|roles|billing|usage limit|usage limits|carrier|exception|shipment|shipments|package|packages|address|delayed|delivered|appointment|appointments|timezone|time zone|slot|slots|reschedule|rescheduling|confirmed|confirmation|hold|missed appointment|packaging|dispatch|damaged|damage|exchange|inspection|estimate|preference|preferences|newsletter)\b/.test(
      t
    ) ||
    /\b(do you (have|sell|carry)|have you got|is .+ available|carry .+)\b/.test(t) ||
    /\b(my|your|this|the)\s+store\b/.test(t) ||
    /\b(order status|tracking number|ship(ping)? eta)\b/.test(t) ||
    // Account mutations must stay STORE so WRITE/ACCOUNT tools are not stripped on GENERAL.
    /\b(update|change|set|save)\s+(my\s+)?(preference|preferences|newsletter|profile|settings|account)\b/.test(
      t
    ) ||
    /\b(my\s+)?(preference|preferences|newsletter)\b.*\b(to|as|=)\b/.test(t);

  const storeFact =
    strongStoreFact ||
    /\b(feature|features|faq|support)\b/.test(t);

  const wantsCompare =
    /\b(compare|vs\.?|versus|difference between)\b/.test(t) &&
    (/\b(store|your|our|online|web|internet)\b/.test(t) || wantsWeb);

  const generalAsk =
    /\b(what is|what'?s|who is|who'?s|how (does|do|can|to)|explain|define|why (is|are|do|does)|tell me about)\b/.test(
      t
    ) && !storeFact;

  // GitHub / connected-MCP inventory asks — not store knowledge, not Confirm (READ).
  const wantsGithub =
    /\bgithub\b/.test(t) ||
    /\b(pull[- ]?requests?|\bprs\b)\b/.test(t) ||
    /\b(repositor(?:y|ies)|repos?)\b/.test(t) ||
    /\b(search|list|find|show|get|fetch)\b[\s\w-]{0,40}\b(commits?|issues?|github users?)\b/.test(
      t
    );

  const entities = [];
  if (/\b(plan|plans|pricing|price|prices|cost|package|packages|subscription|feature|features)\b/.test(t)) {
    entities.push("PLANS");
  }
  if (/\b(sign[ -]?up|register|registration|create an account|open an account)\b/.test(t)) {
    entities.push("SIGNUP");
  }
  if (/\b(maintenance|under maintenance|service status|outage|downtime)\b/.test(t)) {
    entities.push("MAINTENANCE");
  }
  if (/\b(order|shipping|tracking|track|refund|return|ticket|appointment|booking)\b/.test(t)) {
    entities.push("SUPPORT");
  }
  if (
    /\b(preference|preferences|newsletter|profile|settings)\b/.test(t) ||
    /\b(update|change|set|save)\s+(my\s+)?(preference|preferences|newsletter|profile|settings|account)\b/.test(
      t
    )
  ) {
    entities.push("ACCOUNT");
  }

  return {
    wantsWeb,
    storeFact,
    strongStoreFact,
    wantsCompare,
    generalAsk,
    wantsGithub,
    entities,
  };
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

  const { wantsWeb, storeFact, strongStoreFact, wantsCompare } = detectSourceSignals(t);

  // An explicit online request about a named external platform is WEB, even
  // when words such as pricing/availability look like store facts. MIXED is
  // reserved for comparison, or web + strong store-fact asks that are not
  // about a named external platform (e.g. store product availability online).
  const externalWebSubject =
    wantsWeb &&
    strongStoreFact &&
    !wantsCompare &&
    /\b(shopify|botpress|zendesk|salesforce|intercom|openai|google|microsoft)\b/.test(t) &&
    !/\b(my|your|our|this|the)\s+(store|shop|account|plan|pricing|price|policy|return|refund|warranty|booking|appointment|shipping|order)\b/.test(t);

  if (wantsCompare) return "MIXED";
  if (externalWebSubject) return "WEB_REQUEST";
  if (wantsWeb && strongStoreFact) return "MIXED";
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
 *   signals: { wantsWeb: boolean, storeFact: boolean, wantsCompare: boolean, generalAsk: boolean, wantsGithub: boolean },
 *   entities: string[],
 * }}
 */
export function routeSource(utterance, opts = {}) {
  const t = String(utterance || "").toLowerCase();
  const signals = t.trim()
    ? detectSourceSignals(t)
    : {
        wantsWeb: false,
        storeFact: false,
        strongStoreFact: false,
        wantsCompare: false,
        generalAsk: false,
        wantsGithub: false,
        entities: [],
      };
  const intent = classifySourceIntent(utterance);

  /** @type {"STORE"|"WEB"|"GENERAL"|"MIXED"} */
  let route = SOURCE_ROUTES.GENERAL;
  // GitHub/MCP inventory asks stay GENERAL (or WEB if explicit online) — never STORE.
  if (signals.wantsGithub && !signals.wantsWeb && !signals.wantsCompare) {
    route = SOURCE_ROUTES.GENERAL;
  } else if (intent === "STORE_FACT") route = SOURCE_ROUTES.STORE;
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
      !signals.wantsGithub &&
      (route === SOURCE_ROUTES.STORE || route === SOURCE_ROUTES.MIXED),
    entities: signals.entities,
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
export function filterCapabilitiesForSourceRoute(capabilities, decision, opts = {}) {
  const list = Array.isArray(capabilities) ? capabilities : [];
  if (!decision) return list;
  const route = decision.route;
  const stripWrites = route === SOURCE_ROUTES.GENERAL || route === SOURCE_ROUTES.WEB;
  const suppressedNames = opts.suppressedNames instanceof Set
    ? opts.suppressedNames
    : new Set(opts.suppressedNames || []);
  const requestedEntities = new Set(decision.entities || []);
  return list.filter((c) => {
    if (suppressedNames.has(c?.name)) return false;
    const capabilityEntities = Array.isArray(c?.entities)
      ? c.entities.map((value) => String(value).toUpperCase())
      : [];
    const n = String(c?.name || "").toLowerCase();
    const safeNonStoreTools = new Set(["web_search", "request_handoff", "get_conversation_meta"]);
    if (
      (route === SOURCE_ROUTES.GENERAL || route === SOURCE_ROUTES.WEB) &&
      capabilityEntities.length &&
      !safeNonStoreTools.has(n)
    ) {
      return false;
    }
    if (
      requestedEntities.size &&
      capabilityEntities.length &&
      !["web_search", "request_handoff", "get_conversation_meta"].includes(
        String(c?.name || "").toLowerCase()
      ) &&
      !capabilityEntities.some((entity) => requestedEntities.has(entity))
    ) {
      return false;
    }
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
  const githubAddon = decision?.signals?.wantsGithub
    ? [
        "GitHub / repository ask: prefer connected MCP GitHub tools when listed.",
        "Label those results Connected GitHub — never as Your store or Agent knowledge.",
        "Do not call web_search for GitHub account/repo/PR/user inventory unless the user explicitly asked for online/web.",
        "If a tool returns a truncated or partial list, say it is partial from the connected tool and offer a tighter query — never invent extra repos from memory or knowledge.",
        "READ GitHub tools do not need visitor Confirm; Confirm is only for WRITE tools.",
      ].join(" ")
    : "";
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
      "Call web_search before any user-visible reply when you need live results — do not narrate that you are about to search.",
      "Label online results as Online/web — never as Your store.",
      githubAddon,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (route === SOURCE_ROUTES.MIXED) {
    return [
      "## Source route (server): MIXED",
      "Keep two clearly labeled sections: Your store (knowledge/tools only) vs Online (web_search).",
      "Never blend online prices into store facts.",
      githubAddon,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    "## Source route (server): GENERAL",
    "General / public knowledge is allowed — answer conceptual questions (definitions, explanations) helpfully from general knowledge.",
    "Still never invent this business’s private store facts (prices, stock, orders, private policies).",
    githubAddon,
  ]
    .filter(Boolean)
    .join(" ");
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
