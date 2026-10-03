/**
 * Level 3 · L3 — knowledge-gap clustering + PII scrub for drafts (pure).
 */

import { contentHash } from "./embeddings-config.js";
import { cosineSimilarity } from "./rrf.js";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;
const ORDER_RE = /\b(?:order|ord|#)\s*[:#-]?\s*[A-Z0-9-]{5,}\b/gi;

export function scrubPii(text) {
  return String(text || "")
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, "[phone]")
    .replace(ORDER_RE, "[order]")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeQuestionKey(text) {
  return scrubPii(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function clusterKeyForQuestion(text) {
  return contentHash(normalizeQuestionKey(text)).slice(0, 32);
}

/**
 * Group unanswered questions by normalized key; attach optional embedding centroid.
 * @param {Array<{ id: string, text: string, conversationId?: string, embedding?: number[] }>} items
 */
export function clusterQuestions(items, { similarityFloor = 0.82 } = {}) {
  const groups = [];
  for (const item of Array.isArray(items) ? items : []) {
    const key = clusterKeyForQuestion(item.text);
    const embedding = Array.isArray(item.embedding) ? item.embedding : null;
    let matched = groups.find((g) => g.clusterKey === key);
    if (!matched && embedding) {
      matched = groups.find((g) => {
        if (!g.centroid) return false;
        return cosineSimilarity(g.centroid, embedding) >= similarityFloor;
      });
    }
    if (!matched) {
      groups.push({
        clusterKey: key,
        samples: [scrubPii(item.text)],
        conversationIds: item.conversationId ? [item.conversationId] : [],
        centroid: embedding,
        count: 1,
      });
      continue;
    }
    matched.count += 1;
    if (matched.samples.length < 5) matched.samples.push(scrubPii(item.text));
    if (item.conversationId && !matched.conversationIds.includes(item.conversationId)) {
      matched.conversationIds.push(item.conversationId);
    }
    if (embedding && matched.centroid) {
      matched.centroid = matched.centroid.map((v, i) => (v + (embedding[i] || 0)) / 2);
    } else if (embedding && !matched.centroid) {
      matched.centroid = embedding;
    }
  }
  return groups.sort((a, b) => b.count - a.count);
}

/** High similarity to existing knowledge → do not suggest. */
export function isAnsweredByKnowledge(clusterEmbedding, knowledgeEmbeddings, floor = 0.88) {
  if (!Array.isArray(clusterEmbedding) || !Array.isArray(knowledgeEmbeddings)) return false;
  return knowledgeEmbeddings.some((vec) => cosineSimilarity(clusterEmbedding, vec) >= floor);
}

/** Token Jaccard-ish overlap for lexical answered/conflict checks (pure). */
export function tokenOverlapScore(a, b) {
  const tokenize = (text) =>
    new Set(
      normalizeQuestionKey(text)
        .split(" ")
        .filter((t) => t.length > 2)
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

/**
 * Cluster already covered by an existing doc → skip suggestion.
 * @returns {{ documentId: string, score: number } | null}
 */
export function findAnsweredDocument(samples, documents, floor = 0.72) {
  const query = (Array.isArray(samples) ? samples : []).join(" ");
  if (!query) return null;
  let best = null;
  for (const doc of Array.isArray(documents) ? documents : []) {
    const haystack = `${doc.name || ""}\n${String(doc.content || "").slice(0, 1_200)}`;
    const score = tokenOverlapScore(query, haystack);
    if (score >= floor && (!best || score > best.score)) {
      best = { documentId: doc.id, score };
    }
  }
  return best;
}

export function extractClaimSignals(text) {
  const raw = String(text || "");
  return {
    numbers: [...new Set(raw.match(/\b\d+(?:\.\d+)?\b/g) || [])],
    urls: [...new Set((raw.match(/https?:\/\/[^\s)]+/gi) || []).map((u) => u.toLowerCase()))],
  };
}

/**
 * Human draft contradicts an existing article (same topic, different numbers/URLs).
 * @returns {{ documentId: string, score: number } | null}
 */
export function findConflictingDocument(draftAnswer, documents, topicFloor = 0.35) {
  const draft = String(draftAnswer || "");
  if (!draft) return null;
  const draftSignals = extractClaimSignals(draft);
  let best = null;
  for (const doc of Array.isArray(documents) ? documents : []) {
    const topicHaystack = `${doc.name || ""}\n${String(doc.content || "").slice(0, 400)}`;
    const topic = tokenOverlapScore(draft, topicHaystack);
    if (topic < topicFloor) continue;
    const docSignals = extractClaimSignals(doc.content);
    const numConflict =
      draftSignals.numbers.length > 0 &&
      docSignals.numbers.length > 0 &&
      draftSignals.numbers.some((n) => !docSignals.numbers.includes(n)) &&
      docSignals.numbers.some((n) => !draftSignals.numbers.includes(n));
    const urlConflict =
      draftSignals.urls.length > 0 &&
      docSignals.urls.length > 0 &&
      draftSignals.urls.some((u) => !docSignals.urls.includes(u));
    if (!(numConflict || urlConflict)) continue;
    if (!best || topic > best.score) best = { documentId: doc.id, score: topic };
  }
  return best;
}

/** Dismissed clusters reopen only when new source conversations arrive. */
export function hasNewQuestionsSinceDismiss(existingConversationIds, clusterConversationIds) {
  const prev = new Set(
    Array.isArray(existingConversationIds) ? existingConversationIds.map(String) : []
  );
  return (Array.isArray(clusterConversationIds) ? clusterConversationIds : []).some(
    (id) => !prev.has(String(id))
  );
}
