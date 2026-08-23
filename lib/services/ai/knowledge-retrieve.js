/**
 * F08 — Lexical knowledge retrieve (stuffing lite).
 * In-process only: no embeddings API, no LLM re-rank.
 */

export const MAX_KNOWLEDGE_CHARS = 12_000;
export const CHUNK_TARGET_CHARS = 1_000;
export const CHUNK_MIN_CHARS = 800;
export const CHUNK_MAX_CHARS = 1_200;
export const MAX_CHUNKS_PACKED = 12;
/** Cap chunks scored (newest kept) so huge WEB crawls stay cheap. */
export const MAX_CHUNKS_SCORED = 200;
/**
 * Soft F10 (vector RAG) recommendation — not enforced in F08 (Phase F).
 * Prefer opening F10 when an agent has more than F10_DOC_THRESHOLD docs
 * OR more than ~F10_CHARS_THRESHOLD total knowledge characters.
 * No in-process chunk cache in F08 v1 (defer until measured need).
 */
export const F10_DOC_THRESHOLD = 40;
export const F10_CHARS_THRESHOLD = 80_000;
export const TITLE_HIT_BOOST = 0.35;
export const TOPIC_HINT_BOOST = 0.4;
export const WEB_SITE_QUERY_BOOST = 0.2;
export const ORIGIN_HOST_BOOST = 0.25;
export const DEDUP_JACCARD = 0.9;
/** Min Jaccard on char bigrams to accept a garbled↔lexicon match. */
export const NGRAM_SIM_FLOOR = 0.45;
/** When a strong match exists, skip chunks below this absolute floor. */
export const SCORE_FLOOR = 0.05;
/** Also require score >= maxScore * this ratio when packing. */
export const MIN_RELATIVE_SCORE = 0.15;
export const NEAR_SCORE_WINDOW = 0.05;
/** UI + ops: docs longer than this get a “relevant sections only” hint (F08-D). */
export const LARGE_DOC_CHARS = MAX_KNOWLEDGE_CHARS;

export function isLargeKnowledgeDoc(doc) {
  return String(doc?.content || "").length > LARGE_DOC_CHARS;
}

/** Optional env: KNOWLEDGE_MAX_CHARS (min 500). Default 12000. */
export function resolveKnowledgeMaxChars(override) {
  if (override != null && Number.isFinite(Number(override))) {
    return Math.max(500, Number(override));
  }
  const fromEnv = Number.parseInt(process.env.KNOWLEDGE_MAX_CHARS || "", 10);
  if (Number.isFinite(fromEnv) && fromEnv >= 500) return fromEnv;
  return MAX_KNOWLEDGE_CHARS;
}

/** Optional env: KNOWLEDGE_MAX_CHUNKS — how many chunks go into the prompt (1–50). Default 12. */
export function resolveMaxChunksPacked() {
  const fromEnv = Number.parseInt(process.env.KNOWLEDGE_MAX_CHUNKS || "", 10);
  if (Number.isFinite(fromEnv) && fromEnv >= 1) {
    return Math.min(50, fromEnv);
  }
  return MAX_CHUNKS_PACKED;
}

/** Optional env: KNOWLEDGE_MAX_CHUNKS_SCORED — max chunks ranked before packing (50–2000). Default 200. */
export function resolveMaxChunksScored() {
  const fromEnv = Number.parseInt(process.env.KNOWLEDGE_MAX_CHUNKS_SCORED || "", 10);
  if (Number.isFinite(fromEnv) && fromEnv >= 50) {
    return Math.min(2000, fromEnv);
  }
  return MAX_CHUNKS_SCORED;
}

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "my",
  "your",
  "our",
  "their",
  "with",
  "from",
  "by",
  "about",
  "into",
  "over",
  "after",
  "before",
  "not",
  "no",
  "yes",
  "please",
  "what",
  "when",
  "where",
  "who",
  "how",
  "why",
  "which",
  "hai",
  "hain",
  "kya",
  "kyun",
  "nahi",
  "nahin",
  "aap",
  "ap",
  "main",
  "mein",
  "kaise",
  "karo",
  "karna",
  "ji",
  "wala",
  "wali",
]);

const SITE_ISH = new Set([
  "http",
  "https",
  "www",
  "site",
  "website",
  "page",
  "pages",
  "url",
  "domain",
  "homepage",
]);

/**
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  const lower = String(text || "").toLowerCase();
  const raw = lower.match(/[a-z0-9\u0600-\u06ff]+/g) || [];
  const out = [];
  for (const token of raw) {
    if (token.length < 2) continue;
    if (STOPWORDS.has(token)) continue;
    out.push(token);
  }
  return out;
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function hostFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

function isSiteIshQuery(queryTokens) {
  for (const t of queryTokens) {
    if (SITE_ISH.has(t)) return true;
    if (t.includes("www") || t.endsWith(".com") || t.endsWith(".org")) return true;
  }
  return false;
}

/**
 * Split one knowledge doc into stable chunks (~800–1200 chars).
 * @param {{ id: string, name?: string, type?: string, content?: string, origin?: string|null, sourceUrl?: string|null, createdAt?: Date|string|null }} doc
 */
export function chunkDocument(doc) {
  const content = String(doc?.content || "").trim();
  if (!content) return [];

  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pieces = [];
  for (const para of paragraphs) {
    if (para.length <= CHUNK_MAX_CHARS) {
      pieces.push(para);
      continue;
    }
    const sentences = para.split(/(?<=[.!?۔؟])\s+/).filter(Boolean);
    let buf = "";
    for (const sentence of sentences) {
      if (!buf) {
        buf = sentence;
        continue;
      }
      if (buf.length + 1 + sentence.length <= CHUNK_MAX_CHARS) {
        buf = `${buf} ${sentence}`;
      } else {
        pieces.push(buf);
        buf = sentence;
      }
    }
    if (buf) pieces.push(buf);
  }

  const merged = [];
  let current = "";
  for (const piece of pieces) {
    if (!current) {
      current = piece;
      continue;
    }
    if (
      current.length < CHUNK_MIN_CHARS &&
      current.length + 2 + piece.length <= CHUNK_MAX_CHARS
    ) {
      current = `${current}\n\n${piece}`;
    } else if (
      current.length < CHUNK_TARGET_CHARS &&
      current.length + 2 + piece.length <= CHUNK_MAX_CHARS
    ) {
      current = `${current}\n\n${piece}`;
    } else {
      merged.push(current);
      current = piece;
    }
  }
  if (current) merged.push(current);

  const createdAt = doc.createdAt ? new Date(doc.createdAt).getTime() : 0;

  return merged.map((text, i) => ({
    chunkId: `${doc.id}#${i}`,
    docId: doc.id,
    name: doc.name || "Knowledge",
    type: doc.type || "TEXT",
    origin: doc.origin || null,
    sourceUrl: doc.sourceUrl || null,
    createdAt,
    text,
    tokens: tokenize(text),
  }));
}

/**
 * @param {{ text: string, name?: string, type?: string, origin?: string|null, sourceUrl?: string|null, tokens?: string[] }} chunk
 * @param {string[]} queryTokens
 * @param {{ siteIsh?: boolean, siteHost?: string, topicHint?: string|null }} [opts]
 */
export function scoreChunk(chunk, queryTokens, opts = {}) {
  if (!queryTokens.length) return 0;

  const chunkTokens = chunk.tokens || tokenize(chunk.text);
  const unique = new Set(chunkTokens);
  let shared = 0;
  for (const t of queryTokens) {
    if (unique.has(t)) shared += 1;
  }

  const denom = Math.sqrt(queryTokens.length * Math.max(unique.size, 1));
  let score = denom > 0 ? shared / denom : 0;

  const titleTokens = new Set(tokenize(chunk.name || ""));
  for (const t of queryTokens) {
    if (titleTokens.has(t)) {
      score += TITLE_HIT_BOOST;
      break;
    }
  }

  const hint = String(opts.topicHint || "")
    .toLowerCase()
    .trim();
  if (hint) {
    const name = String(chunk.name || "").toLowerCase();
    if (
      name &&
      (name === hint || name.includes(hint) || hint.includes(name))
    ) {
      score += TOPIC_HINT_BOOST;
    }
  }

  const isWeb = String(chunk.type).toUpperCase() === "WEB";
  if (opts.siteIsh && isWeb) {
    score += WEB_SITE_QUERY_BOOST;
  }

  if (opts.siteHost && isWeb) {
    const chunkHost =
      hostFromUrl(chunk.origin) || hostFromUrl(chunk.sourceUrl);
    if (chunkHost && chunkHost === opts.siteHost) {
      score += ORIGIN_HOST_BOOST;
    }
  }

  return score;
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
export function jaccardTokens(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size && !setB.size) return 1;
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

function prefixKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * @param {{ text: string, tokens?: string[] }} candidate
 * @param {{ text: string, tokens?: string[] }[]} packed
 */
export function isNearDuplicate(candidate, packed) {
  const candKey = prefixKey(candidate.text);
  const candTokens = candidate.tokens || tokenize(candidate.text);
  for (const prev of packed) {
    if (candKey && candKey === prefixKey(prev.text)) return true;
    const prevTokens = prev.tokens || tokenize(prev.text);
    if (jaccardTokens(candTokens, prevTokens) >= DEDUP_JACCARD) return true;
  }
  return false;
}

function formatBlock(chunks) {
  if (!chunks.length) return "";
  let text = "## Agent knowledge\n";
  for (const chunk of chunks) {
    text += `### ${chunk.name} (${chunk.type})\n${chunk.text}\n\n`;
  }
  return text.trim();
}

function uniqueUsed(chunks) {
  const seen = new Set();
  const used = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.docId)) continue;
    seen.add(chunk.docId);
    used.push({
      id: chunk.docId,
      name: chunk.name,
      type: chunk.type,
    });
  }
  return used;
}

function compareScored(a, b) {
  if (Math.abs(b.score - a.score) > NEAR_SCORE_WINDOW) {
    return b.score - a.score;
  }
  const aWeb = String(a.chunk.type).toUpperCase() === "WEB";
  const bWeb = String(b.chunk.type).toUpperCase() === "WEB";
  if (aWeb && bWeb) {
    return b.chunk.createdAt - a.chunk.createdAt;
  }
  if (b.score !== a.score) return b.score - a.score;
  return b.chunk.createdAt - a.chunk.createdAt;
}

/** Levenshtein with adjacent transposition (Damerau) for swap typos. */
export function editDistance(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  /** @type {number[][]} */
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (
        i > 1 &&
        j > 1 &&
        s[i - 1] === t[j - 2] &&
        s[i - 2] === t[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[s.length][t.length];
}

/** Drop vowels — helps rnfd ≈ refund (rfnd). */
export function consonantSkeleton(word) {
  return String(word || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/[aeiouy]/g, "");
}

export function maxTypoDistance(tokenLen, { fromTitle = false } = {}) {
  if (tokenLen >= 8) return 3;
  if (tokenLen >= 5) return 2;
  if (tokenLen >= 4) return 1;
  // Short title / acronym-ish tokens: allow 1 edit (cod↔cdo) or prefix path.
  if (fromTitle && tokenLen >= 3) return 1;
  return 0;
}

/** Classic Soundex — catches “sounds like” typos without an extra package. */
export function soundex(word) {
  const w = String(word || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!w) return "";
  const map = {
    b: "1",
    f: "1",
    p: "1",
    v: "1",
    c: "2",
    g: "2",
    j: "2",
    k: "2",
    q: "2",
    s: "2",
    x: "2",
    z: "2",
    d: "3",
    t: "3",
    l: "4",
    m: "5",
    n: "5",
    r: "6",
  };
  let code = w[0].toUpperCase();
  let prev = map[w[0]] || "";
  for (let i = 1; i < w.length && code.length < 4; i += 1) {
    const ch = w[i];
    const mapped = map[ch] || "";
    if (mapped && mapped !== prev) {
      code += mapped;
      prev = mapped;
    } else if (!mapped) {
      if ("aeiouyhw".includes(ch)) prev = "";
    }
  }
  return `${code}000`.slice(0, 4);
}

export function charNgrams(text, n = 2) {
  const t = String(text || "").toLowerCase();
  const grams = new Set();
  if (t.length < n) {
    if (t) grams.add(t);
    return grams;
  }
  for (let i = 0; i <= t.length - n; i += 1) {
    grams.add(t.slice(i, i + n));
  }
  return grams;
}

/** Jaccard similarity over character bigrams (garbled spelling). */
export function ngramSimilarity(a, b, n = 2) {
  const A = charNgrams(a, n);
  const B = charNgrams(b, n);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const g of A) {
    if (B.has(g)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Build lexicon from doc titles + content sample.
 * Title terms keep length ≥3; content terms ≥4.
 * @param {object[]} docs
 * @returns {{ term: string, phrase: string, fromTitle: boolean, soundex: string }[]}
 */
export function buildKnowledgeLexicon(docs) {
  const out = [];
  const seen = new Set();
  for (const doc of docs || []) {
    const name = String(doc.name || "").trim();
    const nameTokens = tokenize(name);
    for (const term of nameTokens) {
      if (term.length < 3 || seen.has(term)) continue;
      seen.add(term);
      out.push({
        term,
        phrase: name || term,
        fromTitle: true,
        soundex: soundex(term),
      });
    }
    const contentTokens = tokenize(String(doc.content || "").slice(0, 4000));
    for (const term of contentTokens) {
      if (term.length < 4 || seen.has(term)) continue;
      seen.add(term);
      out.push({
        term,
        phrase: name || term,
        fromTitle: false,
        soundex: soundex(term),
      });
    }
  }
  return out;
}

/**
 * Prefer a unique term; else title-only; else topicHint overlap.
 * @returns {{ term: string, phrase: string, fromTitle: boolean, via: string }|null}
 */
export function resolveAmbiguousMatches(matches, topicHint = null) {
  if (!matches?.length) return null;
  const uniqueTerms = [...new Set(matches.map((m) => m.term))];
  if (uniqueTerms.length === 1) {
    return { ...matches[0], via: matches[0].via || "unique" };
  }

  const hint = String(topicHint || "")
    .toLowerCase()
    .trim();
  if (hint) {
    const byTopic = matches.filter((m) => {
      const phrase = String(m.phrase || "").toLowerCase();
      const term = String(m.term || "").toLowerCase();
      return (
        phrase === hint ||
        phrase.includes(hint) ||
        hint.includes(phrase) ||
        hint.includes(term) ||
        term === hint
      );
    });
    const topicTerms = [...new Set(byTopic.map((m) => m.term))];
    if (topicTerms.length === 1) {
      return { ...byTopic[0], via: "topic" };
    }
  }

  const titleOnly = matches.filter((m) => m.fromTitle);
  const titleTerms = [...new Set(titleOnly.map((m) => m.term))];
  if (titleTerms.length === 1) {
    return { ...titleOnly[0], via: "title" };
  }

  return null;
}

/**
 * Best lexicon hit for one query token (edit / prefix / phonetic / n-gram).
 * @param {string} q
 * @param {{ term: string, phrase: string, fromTitle: boolean, soundex: string }[]} lexicon
 * @param {string|null} [topicHint]
 */
export function findBestLexiconMatch(q, lexicon, topicHint = null) {
  const token = String(q || "").toLowerCase();
  if (!token || token.length < 3 || !lexicon?.length) return null;
  if (STOPWORDS.has(token)) return null;

  const exact = lexicon.find((row) => row.term === token);
  if (exact) {
    return { ...exact, via: "exact", distance: 0 };
  }

  // --- edit distance ---
  let bestDist = Infinity;
  /** @type {typeof lexicon} */
  const editHits = [];
  for (const row of lexicon) {
    const maxDist = maxTypoDistance(token.length, { fromTitle: row.fromTitle });
    if (maxDist < 1) continue;
    if (Math.abs(row.term.length - token.length) > maxDist) continue;
    const d = editDistance(token, row.term);
    if (d < 1 || d > maxDist) continue;
    if (d < bestDist) {
      bestDist = d;
      editHits.length = 0;
      editHits.push({ ...row, via: "edit", distance: d });
    } else if (d === bestDist) {
      editHits.push({ ...row, via: "edit", distance: d });
    }
  }
  const editPick = resolveAmbiguousMatches(editHits, topicHint);
  if (editPick) return editPick;

  // --- unique prefix (short typos / partials: "ref" → refund) ---
  if (token.length >= 3) {
    const prefixHits = lexicon.filter(
      (row) =>
        row.term.length >= token.length && row.term.startsWith(token)
    );
    const prefixPick = resolveAmbiguousMatches(
      prefixHits.map((row) => ({ ...row, via: "prefix", distance: 0 })),
      topicHint
    );
    if (prefixPick) return prefixPick;
  }

  // --- phonetic (Soundex) — same initial + similar length; avoid please→policy ---
  if (token.length >= 4) {
    const sx = soundex(token);
    if (sx) {
      const phoneHits = lexicon.filter((row) => {
        if (row.term.length < 4) return false;
        if (row.soundex !== sx) return false;
        if (row.term[0] !== token[0]) return false;
        if (Math.abs(row.term.length - token.length) > 2) return false;
        // Extra guard: some shared letters beyond soundex collision
        return ngramSimilarity(token, row.term) >= 0.25;
      });
      const phonePick = resolveAmbiguousMatches(
        phoneHits.map((row) => ({ ...row, via: "phonetic", distance: 0 })),
        topicHint
      );
      if (phonePick) return phonePick;
    }
  }

  // --- consonant skeleton (rnfd ≈ refund → rfnd) ---
  if (token.length >= 4) {
    const sq = consonantSkeleton(token);
    if (sq.length >= 3) {
      let bestSk = Infinity;
      /** @type {typeof lexicon} */
      const skHits = [];
      for (const row of lexicon) {
        if (row.term.length < 4) continue;
        const st = consonantSkeleton(row.term);
        if (st.length < 3) continue;
        if (Math.abs(st.length - sq.length) > 2) continue;
        const d = editDistance(sq, st);
        const maxSk = Math.max(1, Math.min(2, Math.floor(sq.length / 2)));
        if (d > maxSk) continue;
        if (d < bestSk) {
          bestSk = d;
          skHits.length = 0;
          skHits.push({ ...row, via: "skeleton", distance: d });
        } else if (d === bestSk) {
          skHits.push({ ...row, via: "skeleton", distance: d });
        }
      }
      const skPick = resolveAmbiguousMatches(skHits, topicHint);
      if (skPick) return skPick;
    }
  }

  // --- char n-gram (garbled near-misses) ---
  if (token.length >= 4) {
    let bestSim = 0;
    /** @type {typeof lexicon} */
    const gramHits = [];
    for (const row of lexicon) {
      if (row.term.length < 4) continue;
      if (Math.abs(row.term.length - token.length) > 3) continue;
      const sim = ngramSimilarity(token, row.term);
      if (sim < NGRAM_SIM_FLOOR) continue;
      if (sim > bestSim + 0.02) {
        bestSim = sim;
        gramHits.length = 0;
        gramHits.push({ ...row, via: "ngram", distance: 1 - sim });
      } else if (Math.abs(sim - bestSim) <= 0.02) {
        gramHits.push({ ...row, via: "ngram", distance: 1 - sim });
      }
    }
    const gramPick = resolveAmbiguousMatches(gramHits, topicHint);
    if (gramPick) return gramPick;
  }

  // Ambiguous edit hits → surface for clarify (caller may ask).
  if (editHits.length) {
    return { ambiguous: true, candidates: editHits };
  }

  return null;
}

function queryCandidateTokens(query) {
  const base = tokenize(query);
  const raw = String(query || "")
    .toLowerCase()
    .match(/[a-z0-9\u0600-\u06ff]+/g) || [];
  // Include short raw tokens (≥3) so prefix/title fuzzy can fire — skip stopwords.
  return [
    ...new Set([
      ...base,
      ...raw.filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
    ]),
  ];
}

/**
 * Map misspelled / partial query tokens onto knowledge lexicon terms.
 * @param {string} query
 * @param {object[]} docs
 * @param {{ topicHint?: string|null }} [opts]
 * @returns {{ tokens: string[], fuzzyHits: { from: string, to: string, phrase: string, via: string }[], ambiguous: { phrase: string, term: string }[] }}
 */
export function expandQueryTokensWithFuzzy(query, docs, opts = {}) {
  const base = tokenize(query);
  const topicHint = opts.topicHint || null;
  const candidates = queryCandidateTokens(query);

  if (!candidates.length || !docs?.length) {
    return { tokens: base, fuzzyHits: [], ambiguous: [] };
  }

  const lexicon = buildKnowledgeLexicon(docs);
  const lexiconTerms = new Set(lexicon.map((row) => row.term));
  const seen = new Set(base);
  const tokens = [...base];
  /** @type {{ from: string, to: string, phrase: string, via: string }[]} */
  const fuzzyHits = [];
  /** @type {{ phrase: string, term: string }[]} */
  const ambiguous = [];
  const ambPhrases = new Set();

  for (const q of candidates) {
    if (lexiconTerms.has(q)) continue;

    const hit = findBestLexiconMatch(q, lexicon, topicHint);
    if (!hit) continue;

    if (hit.ambiguous) {
      for (const c of hit.candidates || []) {
        if (ambPhrases.has(c.phrase)) continue;
        ambPhrases.add(c.phrase);
        ambiguous.push({ phrase: c.phrase, term: c.term });
      }
      continue;
    }

    if (seen.has(hit.term)) continue;
    seen.add(hit.term);
    tokens.push(hit.term);
    fuzzyHits.push({
      from: q,
      to: hit.term,
      phrase: hit.phrase,
      via: hit.via || "fuzzy",
    });
  }

  return { tokens, fuzzyHits, ambiguous: ambiguous.slice(0, 3) };
}

/**
 * When score is still weak, suggest knowledge phrases (typo / ambiguous).
 * @param {string} query
 * @param {object[]} docs
 * @param {{ topicHint?: string|null }} [opts]
 */
export function findTypoClarifications(query, docs, opts = {}) {
  const topicHint = opts.topicHint || null;
  const candidates = queryCandidateTokens(query);
  if (!candidates.length || !docs?.length) return [];

  const lexicon = buildKnowledgeLexicon(docs);
  const hits = [];
  const hitPhrases = new Set();

  for (const q of candidates) {
    if (lexicon.some((row) => row.term === q)) continue;
    const hit = findBestLexiconMatch(q, lexicon, topicHint);
    if (!hit) continue;

    if (hit.ambiguous) {
      for (const c of hit.candidates || []) {
        if (hitPhrases.has(c.phrase)) continue;
        hitPhrases.add(c.phrase);
        hits.push({ phrase: c.phrase, term: c.term });
      }
      continue;
    }

    if (hitPhrases.has(hit.phrase)) continue;
    hitPhrases.add(hit.phrase);
    hits.push({ phrase: hit.phrase, term: hit.term });
  }

  return hits.slice(0, 3);
}

export function formatClarifyQuestion(clarify) {
  const list = Array.isArray(clarify) ? clarify : [];
  if (!list.length) return "";
  if (list.length === 1) {
    return `Did you ask about our **${list[0].phrase}**? Reply yes and I’ll answer from our knowledge — or rephrase your question.`;
  }
  const bullets = list.map((c) => `• **${c.phrase}**`).join("\n");
  return `Your message looks unclear (possible spelling). Did you mean one of these?\n\n${bullets}\n\nReply with the topic name, or rephrase your question.`;
}

/** True when the user confirms a prior clarify question. */
export function isAffirmativeReply(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "");
  return /^(yes|yep|yeah|y|haan|han|ji|ok|okay|sure|confirm|confirmed)$/.test(
    t
  );
}

/** Pull **bold** topic phrases from a clarify assistant message. */
export function extractClarifyPhrases(assistantContent) {
  const phrases = [];
  const re = /\*\*([^*]+)\*\*/g;
  let m;
  while ((m = re.exec(String(assistantContent || "")))) {
    const p = m[1].trim();
    if (!p || /^(yes|no)$/i.test(p)) continue;
    phrases.push(p);
  }
  return phrases;
}

/**
 * Prefer last clarify topic, else last user message that overlaps a doc title.
 * @param {{ role: string, content: string }[]} recentMessagesDesc newest-first
 * @param {object[]} docs
 */
export function extractTopicHint(recentMessagesDesc = [], docs = []) {
  for (const msg of recentMessagesDesc) {
    if (String(msg.role).toUpperCase() !== "ASSISTANT") continue;
    if (!/did you (ask about|mean)/i.test(msg.content || "")) continue;
    const phrases = extractClarifyPhrases(msg.content);
    if (phrases[0]) return phrases[0];
  }

  const prior = recentMessagesDesc.slice(1);
  for (const msg of prior) {
    if (String(msg.role).toUpperCase() !== "USER") continue;
    const tokens = new Set(tokenize(msg.content));
    if (!tokens.size) continue;
    for (const doc of docs) {
      const name = String(doc.name || "").trim();
      if (!name) continue;
      const nameTokens = tokenize(name);
      if (nameTokens.some((t) => tokens.has(t))) return name;
    }
  }
  return null;
}

/**
 * If user said "yes" after a clarify, rewrite the retrieve query to the suggested topic.
 * @param {string} message
 * @param {{ role: string, content: string }[]} recentMessagesDesc newest-first (may include current user msg)
 */
export function resolveRetrieveQuery(message, recentMessagesDesc = []) {
  const raw = String(message || "");
  if (!isAffirmativeReply(raw)) return raw;

  for (const msg of recentMessagesDesc) {
    if (String(msg.role).toUpperCase() !== "ASSISTANT") continue;
    if (!/did you (ask about|mean)/i.test(msg.content || "")) continue;
    const phrases = extractClarifyPhrases(msg.content);
    if (phrases.length === 1) {
      return `Tell me about ${phrases[0]}`;
    }
    return raw;
  }
  return raw;
}

/**
 * Chunk → score → dedupe → pack under char budget.
 * Fuzzy stack: edit + prefix + Soundex + n-gram; topicHint breaks ties.
 * Soft fallback: clarify when near terms exist; else pack newest 1–2 chunks.
 * (True semantic embeddings remain F10.)
 *
 * @param {{ docs: object[], query: string, maxChars?: number, siteKnowledgeOrigin?: string|null, topicHint?: string|null, recentMessages?: { role: string, content: string }[] }} args
 */
export function selectKnowledgeChunks({
  docs,
  query,
  maxChars,
  siteKnowledgeOrigin = null,
  topicHint = null,
  recentMessages = null,
}) {
  const list = Array.isArray(docs) ? docs : [];
  if (!list.length) return { text: "", used: [] };

  const budget = resolveKnowledgeMaxChars(maxChars);
  const packLimit = resolveMaxChunksPacked();
  const scoreLimit = resolveMaxChunksScored();

  const resolvedHint =
    topicHint ||
    (recentMessages ? extractTopicHint(recentMessages, list) : null);

  const { tokens: queryTokens, fuzzyHits, ambiguous } =
    expandQueryTokensWithFuzzy(query, list, { topicHint: resolvedHint });
  const siteHost = hostFromUrl(siteKnowledgeOrigin);
  const siteIsh = isSiteIshQuery(queryTokens) || Boolean(siteHost);

  /** @type {ReturnType<typeof chunkDocument>} */
  let chunks = [];
  for (const doc of list) {
    chunks = chunks.concat(chunkDocument(doc));
  }
  if (!chunks.length) return { text: "", used: [] };

  if (chunks.length > scoreLimit) {
    chunks = [...chunks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, scoreLimit);
  }

  const scored = chunks.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, queryTokens, {
      siteIsh,
      siteHost,
      topicHint: resolvedHint,
    }),
  }));

  scored.sort(compareScored);

  const maxScore = scored[0]?.score ?? 0;
  const softFallback = maxScore < 0.01;

  if (softFallback) {
    const clarify =
      ambiguous.length > 0
        ? ambiguous
        : findTypoClarifications(query, list, { topicHint: resolvedHint });
    if (clarify.length) {
      return {
        text: "",
        used: [],
        clarify,
        fuzzyHits,
        topicHint: resolvedHint,
      };
    }
  }

  /** @type {{ chunk: (typeof chunks)[0], score: number }[]} */
  let rankedRows;
  if (softFallback) {
    rankedRows = [...chunks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 2)
      .map((chunk) => ({ chunk, score: 0 }));
  } else {
    const minKeep = Math.max(SCORE_FLOOR, maxScore * MIN_RELATIVE_SCORE);
    rankedRows = scored.filter((row) => row.score >= minKeep);
    if (!rankedRows.length) {
      rankedRows = scored.slice(0, 1);
    }
  }

  const packed = [];
  let usedChars = "## Agent knowledge\n".length;

  for (const { chunk } of rankedRows) {
    if (packed.length >= packLimit) break;
    if (isNearDuplicate(chunk, packed)) continue;

    const piece = `### ${chunk.name} (${chunk.type})\n${chunk.text}\n\n`;
    if (usedChars + piece.length > budget) {
      if (packed.length === 0) {
        const room = Math.max(0, budget - usedChars - 80);
        if (room > 40) {
          packed.push({
            ...chunk,
            text: `${chunk.text.slice(0, room)}…`,
          });
        }
      }
      break;
    }
    packed.push(chunk);
    usedChars += piece.length;
  }

  return {
    text: formatBlock(packed),
    used: uniqueUsed(packed),
    ...(fuzzyHits.length ? { fuzzyHits } : {}),
    ...(resolvedHint ? { topicHint: resolvedHint } : {}),
  };
}
