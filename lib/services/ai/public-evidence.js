/**
 * Phase 4B — conservative public-evidence routing.
 *
 * Knowledge is data, never authority. This module only decides whether a
 * redundant public-read capability may be hidden for the current turn. The
 * action gateway still enforces the decision if a model attempts to call it.
 */

const PUBLIC_PLAN_TERMS = /\b(plans?|pricing|prices?|cost|subscriptions?|packages?|features?)\b/i;
const PUBLIC_PRICE_EVIDENCE = /(?:\$|€|£|\bfree\b|\bprice(?:s|d)?\b|\bcost\b|\bmonth(?:ly)?\b|\byear(?:ly)?\b|\bannual\b|\bsubscription\b)/i;
const PERSONAL_TERMS = /\b(my|me|mine|account|invoice|receipt|payment|billing status|usage|quota|renew|cancel|refund|private|logged[ -]?in)\b/i;
const LIVE_TERMS = /\b(current|currently|latest|today|right now|live|updated|as of)\b/i;
const MONTHLY_TERMS = /\b(monthly|per month|\/month|a month)\b/i;
const YEARLY_TERMS = /\b(yearly|annual|annually|per year|\/year|a year)\b/i;
const LIMIT_TERMS = /\b(limit|limits|quota|quotas|users?|messages?|credits?|usage)\b/i;
const CURRENCY_TERMS = /\b(usd|dollars?|eur|euros?|gbp|pounds?|currency)\b|[$€£]/i;

/**
 * @param {{name?: string, accessClass?: string, riskLevel?: string, identityMode?: string, requiresIdentity?: boolean, requiresConfirmation?: boolean, _builtin?: boolean}} action
 */
export function isSuppressiblePublicRead(action) {
  if (!action || action._builtin || action._mcp) return false;
  if (String(action.accessClass || "").toUpperCase() !== "PUBLIC_READ") return false;
  if (String(action.riskLevel || "READ").toUpperCase() !== "READ") return false;
  if (String(action.identityMode || "").toUpperCase() === "END_USER_TOKEN") return false;
  if (action.requiresIdentity) return false;
  return true;
}

/**
 * Decide whether selected public site evidence is sufficient for a public
 * plans/pricing answer. This intentionally fails closed for ambiguous asks.
 * @param {{ query?: string, route?: string, selectedUsed?: Array<{id?: string}>, knowledgeDocs?: Array<object>, siteKnowledgeOrigin?: string|null, crawlStatus?: string|null, crawlStale?: boolean }} input
 */
export function decidePublicEvidence({
  query = "",
  route = "",
  selectedUsed = [],
  knowledgeDocs = [],
  siteKnowledgeOrigin = null,
  crawlStatus = null,
  crawlStale = false,
} = {}) {
  const text = String(query || "").trim();
  if (!text || String(route).toUpperCase() !== "STORE") {
    return { sufficient: false, reasonCode: "NOT_PUBLIC_STORE_FACT" };
  }
  if (!PUBLIC_PLAN_TERMS.test(text)) {
    return { sufficient: false, reasonCode: "NOT_PLAN_OR_PRICING" };
  }
  if (PERSONAL_TERMS.test(text) || LIVE_TERMS.test(text)) {
    return { sufficient: false, reasonCode: "PERSONAL_OR_LIVE_REQUEST" };
  }
  if (crawlStale || String(crawlStatus || "").toUpperCase() !== "DONE") {
    return { sufficient: false, reasonCode: "PUBLIC_KNOWLEDGE_NOT_FRESH" };
  }

  const selectedIds = new Set(
    (Array.isArray(selectedUsed) ? selectedUsed : [])
      .map((item) => item?.id)
      .filter(Boolean)
  );
  const originHost = hostOf(siteKnowledgeOrigin);
  const evidence = (Array.isArray(knowledgeDocs) ? knowledgeDocs : []).filter(
    (doc) => {
      if (!selectedIds.has(doc?.id)) return false;
      if (String(doc?.type || "").toUpperCase() !== "WEB") return false;
      const sourceHost = hostOf(doc?.sourceUrl || doc?.origin);
      if (!originHost || !sourceHost || sourceHost !== originHost) return false;
      const content = String(doc?.content || "");
      return PUBLIC_PLAN_TERMS.test(content) && PUBLIC_PRICE_EVIDENCE.test(content);
    }
  );

  const evidenceText = evidence.map((doc) => String(doc.content || "")).join("\n");
  const requirements = [
    [MONTHLY_TERMS, /\b(monthly|per month|\/month|a month)\b/i],
    [YEARLY_TERMS, /\b(yearly|annual|annually|per year|\/year|a year)\b/i],
    [LIMIT_TERMS, /\b(limit|limits|quota|quotas|unlimited|users?|messages?|credits?|usage)\b/i],
    [CURRENCY_TERMS, /\b(usd|dollars?|eur|euros?|gbp|pounds?|currency)\b|[$€£]/i],
  ];
  const missingRequirement = requirements.find(
    ([queryPattern, evidencePattern]) =>
      queryPattern.test(text) && !evidencePattern.test(evidenceText)
  );

  if (missingRequirement) {
    return { sufficient: false, reasonCode: "INCOMPLETE_PUBLIC_EVIDENCE" };
  }

  return evidence.length
    ? {
        sufficient: true,
        reasonCode: "PUBLIC_PLAN_EVIDENCE",
        evidenceDocumentIds: evidence.map((doc) => doc.id),
      }
    : { sufficient: false, reasonCode: "INSUFFICIENT_PUBLIC_EVIDENCE" };
}

function hostOf(value) {
  try {
    return new URL(String(value || "")).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * @param {Array<object>} actions
 * @param {Set<string>} suppressedNames
 */
export function filterRedundantPublicReads(actions, suppressedNames = new Set()) {
  const names = suppressedNames instanceof Set ? suppressedNames : new Set(suppressedNames || []);
  if (!names.size) return Array.isArray(actions) ? actions : [];
  return (Array.isArray(actions) ? actions : []).filter(
    (action) => !(names.has(action?.name) && isSuppressiblePublicRead(action))
  );
}
