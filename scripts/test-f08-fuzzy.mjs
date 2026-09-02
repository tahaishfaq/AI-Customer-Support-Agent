/**
 * F08 deep fuzzy suite — edit / prefix / phonetic / n-gram / topicHint / clarify.
 * Run: npm run test:f08-fuzzy
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildKnowledgeLexicon,
  editDistance,
  expandQueryTokensWithFuzzy,
  extractTopicHint,
  findBestLexiconMatch,
  ngramSimilarity,
  selectKnowledgeChunks,
  soundex,
} from "../lib/services/ai/knowledge-retrieve.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const docs = [
  {
    id: "r",
    name: "Refund FAQ",
    type: "TEXT",
    content: "Our refund policy: money back within 5 business days after return.",
    createdAt: "2024-06-01T00:00:00.000Z",
  },
  {
    id: "s",
    name: "Shipping Guide",
    type: "TEXT",
    content: "Standard shipping takes 3–5 business days worldwide.",
    createdAt: "2024-05-01T00:00:00.000Z",
  },
  {
    id: "w",
    name: "Warranty Policy",
    type: "TEXT",
    content: "Hardware warranty covers defects for 12 months from purchase.",
    createdAt: "2024-04-01T00:00:00.000Z",
  },
  {
    id: "n",
    name: "Noise Plants",
    type: "TEXT",
    content: "Unrelated cactus watering schedule for lobby plants.",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

function usedNames(result) {
  return (result.used || []).map((u) => u.name);
}

function main() {
  const src = read("lib/services/ai/knowledge-retrieve.js");
  assert(/soundex|ngramSimilarity|TOPIC_HINT_BOOST/.test(src), "fuzzy stack in retrieve");
  assert(/extractTopicHint|recentMessages/.test(src), "topic hint wired");

  const chat = read("lib/services/chat.service.js");
  assert(/recentMessages/.test(chat), "chat passes recentMessages");

  // --- primitives ---
  assert(editDistance("reunf", "refund") === 2, "reunf↔refund distance 2");
  assert(soundex("refund") === soundex("rifund"), "soundex refund≈rifund");
  assert(
    ngramSimilarity("refnd", "refund") >= 0.45,
    "ngram refnd related to refund"
  );
  assert(
    editDistance("rnfd", "rfnd") <= 2,
    "skeleton rnfd near refund consonants"
  );

  const lexicon = buildKnowledgeLexicon(docs);
  assert(
    lexicon.some((r) => r.term === "refund" && r.fromTitle),
    "title term refund"
  );
  assert(
    lexicon.some((r) => r.term.length === 3 || r.term === "faq"),
    "short title tokens allowed (≥3)"
  );

  // --- edit ---
  {
    const s = selectKnowledgeChunks({ docs, query: "reunf plocy" });
    assert(usedNames(s).includes("Refund FAQ"), "edit: reunf plocy → Refund FAQ");
    assert(!s.clarify?.length, "edit confident → no clarify");
    assert(
      s.fuzzyHits?.some((h) => h.to === "refund"),
      "fuzzyHits records refund"
    );
  }

  // --- prefix (short) ---
  {
    const s = selectKnowledgeChunks({ docs, query: "ref" });
    assert(
      usedNames(s).includes("Refund FAQ"),
      "prefix: ref → Refund FAQ"
    );
    assert(
      s.fuzzyHits?.some((h) => h.via === "prefix" && h.to === "refund"),
      "via prefix"
    );
  }

  // --- phonetic ---
  {
    const hit = findBestLexiconMatch("rifund", lexicon);
    assert(hit && hit.term === "refund", "phonetic: rifund → refund");
    const s = selectKnowledgeChunks({ docs, query: "tell me about rifund" });
    assert(usedNames(s).includes("Refund FAQ"), "phonetic retrieve Refund FAQ");

    const please = findBestLexiconMatch("please", lexicon);
    assert(!please, "stopword/please must not map to policy");
  }

  // --- n-gram / skeleton garbled ---
  {
    const hit = findBestLexiconMatch("rnfd", lexicon);
    assert(hit && hit.term === "refund", "skeleton: rnfd → refund");
    const s = selectKnowledgeChunks({ docs, query: "rnfd info" });
    assert(usedNames(s).includes("Refund FAQ"), "skeleton retrieve Refund FAQ");
    assert(
      s.fuzzyHits?.some((h) => h.to === "refund"),
      "fuzzyHits for rnfd"
    );
    assert(
      !s.fuzzyHits?.some((h) => h.from === "please"),
      "no please→policy false hit"
    );

    const ngramHit = findBestLexiconMatch("refnd", lexicon);
    assert(ngramHit && ngramHit.term === "refund", "refnd → refund");
  }

  // --- shipping / warranty (not only refund) ---
  {
    const ship = selectKnowledgeChunks({ docs, query: "shiping times" });
    assert(usedNames(ship).includes("Shipping Guide"), "shiping → Shipping Guide");

    const war = selectKnowledgeChunks({ docs, query: "warrenty length" });
    assert(usedNames(war).includes("Warranty Policy"), "warrenty → Warranty Policy");
  }

  // --- topicHint breaks ambiguity ---
  {
    const ambDocs = [
      {
        id: "1",
        name: "Return Portal",
        type: "TEXT",
        content: "Use the return portal to start a return request.",
        createdAt: "2024-03-01T00:00:00.000Z",
      },
      {
        id: "2",
        name: "Refund FAQ",
        type: "TEXT",
        content: "Refunds post after we receive your return.",
        createdAt: "2024-03-02T00:00:00.000Z",
      },
    ];
    const withHint = selectKnowledgeChunks({
      docs: ambDocs,
      query: "retrun status",
      topicHint: "Refund FAQ",
    });
    assert(
      usedNames(withHint).includes("Refund FAQ") ||
        withHint.fuzzyHits?.some((h) => /refund/i.test(h.to)),
      "topicHint steers toward Refund FAQ"
    );

    const fromHistory = extractTopicHint(
      [
        { role: "USER", content: "retrun status" },
        {
          role: "ASSISTANT",
          content: "Did you ask about our **Refund FAQ**? Reply yes.",
        },
        { role: "USER", content: "what about returns" },
      ],
      ambDocs
    );
    assert(fromHistory === "Refund FAQ", "extractTopicHint from clarify");
  }

  // --- history path through select ---
  {
    const s = selectKnowledgeChunks({
      docs,
      query: "more details please",
      recentMessages: [
        { role: "USER", content: "more details please" },
        { role: "USER", content: "I need the refund timeline" },
      ],
    });
    assert(
      s.topicHint === "Refund FAQ" || usedNames(s).includes("Refund FAQ"),
      "history topic or refund retrieve"
    );
  }

  // --- soft / no false positive on noise-only query ---
  {
    const soft = selectKnowledgeChunks({
      docs: [docs[3]],
      query: "xyzzy qqzz",
    });
    assert(soft.text.length > 0 || soft.used.length > 0, "soft fallback still packs");
    assert(!soft.clarify?.length, "no bogus clarify on nonsense vs cactus");
  }

  // --- exact still works ---
  {
    const exact = selectKnowledgeChunks({
      docs,
      query: "What is your refund policy?",
    });
    assert(usedNames(exact).includes("Refund FAQ"), "exact refund query");
    assert(exact.text.includes("5 business"), "packs refund content");
  }

  assert(/test:f08-fuzzy/.test(read("package.json")), "npm script");

  console.log("ok  F08 deep fuzzy (edit/prefix/phonetic/ngram/topic)");
  console.log("\nF08 fuzzy deep test passed");
}

main();
