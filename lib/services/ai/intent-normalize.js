/**
 * Intent matching helpers: typo-tolerant source words and short follow-up detection.
 * Pure and display-free — only used to decide which tools/source to offer; the text sent to
 * the model is never rewritten, and policy still gates every call.
 */

import { editDistance } from "./knowledge-retrieve.js";

/**
 * Canonical words whose misspellings break source routing ("repositores", "gihtub").
 * Kept deliberately small: short/common words (repos, issues, commits) have too many real
 * neighbours (repost, issued, comments) to correct safely.
 */
const TYPO_VOCABULARY = ["repository", "repositories", "github"];

function maxDistance(tokenLength) {
  return tokenLength >= 9 ? 2 : 1;
}

/** Canonical vocabulary word for a token, or null when it is not a near-miss. */
export function correctIntentToken(token) {
  const word = String(token || "").toLowerCase();
  if (word.length < 5 || TYPO_VOCABULARY.includes(word)) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const target of TYPO_VOCABULARY) {
    if (target[0] !== word[0]) continue;
    const distance = editDistance(word, target);
    if (distance <= maxDistance(word.length) && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

/** Lowercased text with near-miss source words replaced by their canonical form. */
export function normalizeIntentTypos(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[a-z]+/g, (token) => correctIntentToken(token) || token);
}

const BARE_FOLLOW_UP =
  /^\s*(and\s+)?(more|next|next\s+(batch|page|ones|\d+)|show\s+(me\s+)?(all|more|the\s+rest)|list\s+(them\s+)?all|all\s+of\s+them|the\s+rest|rest\s+of\s+them|remaining(\s+ones)?|continue|go\s+on|full\s+list)\s*(please|pls)?\s*[?.!]*\s*$/;
const ANAPHOR = /\b(them|those|these|the\s+rest|rest\s+of\s+them|remaining|the\s+others|other\s+ones|same)\b/;
const FOLLOW_UP_ACTION =
  /\b(list|show|give|get|fetch|display|send|see|view|all|more|next|remaining|rest|others|full|complete)\b/;

/**
 * Short message that continues the previous request without naming its subject
 * ("list all of them", "show the rest", "more"). A pronoun alone ("tell them I'm upset") is not enough.
 */
export function isFollowUpReference(text) {
  const t = String(text || "").toLowerCase().trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  if (BARE_FOLLOW_UP.test(t)) return true;
  return ANAPHOR.test(t) && FOLLOW_UP_ACTION.test(t);
}
