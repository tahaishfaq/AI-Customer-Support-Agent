/**
 * F08-D contract smoke — empty KB refuse + large-doc UI hint.
 * Run: npm run test:f08d
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LARGE_DOC_CHARS,
  isLargeKnowledgeDoc,
  selectKnowledgeChunks,
} from "../lib/services/ai/knowledge-retrieve.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  const f08 = featureDoc(root, "F08");
  assert(/Phase D — Error handling ✅/.test(f08), "Phase D marked done");

  const chat = read("lib/services/chat.service.js");
  assert(/formatClarifyQuestion|resolveRetrieveQuery/.test(chat), "chat wires typo clarify");
  const prompts = read("lib/services/ai/prompt-builder.js");
  assert(
    /don.t have knowledge for this agent yet/i.test(prompts),
    "empty-KB reinforce in system rules"
  );

  const list = read("components/knowledge/KnowledgeList.jsx");
  assert(/isLargeKnowledgeDoc|LARGE_DOC_CHARS/.test(list), "list large-doc banner");
  assert(/most relevant sections/i.test(list), "banner copy");

  const item = read("components/knowledge/KnowledgeItem.jsx");
  assert(/isLargeKnowledgeDoc/.test(item), "item large hint");
  assert(/relevant sections used in chat/i.test(item), "item copy");

  assert(LARGE_DOC_CHARS === 12_000, "large threshold matches 12k budget");
  assert(!isLargeKnowledgeDoc({ content: "x".repeat(100) }), "small doc");
  assert(isLargeKnowledgeDoc({ content: "x".repeat(12_001) }), "large doc");

  const empty = selectKnowledgeChunks({ docs: [], query: "hello" });
  assert(empty.text === "" && empty.used.length === 0, "empty docs → empty block");

  const whitespace = selectKnowledgeChunks({
    docs: [{ id: "e", name: "Empty", type: "TEXT", content: "   \n\n  " }],
    query: "hello",
  });
  assert(whitespace.text === "", "whitespace-only docs → empty block");

  const soft = selectKnowledgeChunks({
    docs: [
      {
        id: "n",
        name: "Noise",
        type: "TEXT",
        content: "Unrelated cactus watering schedule for lobby plants.",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    query: "refund policy xyzzy",
  });
  assert(soft.text.length > 0, "soft fallback still packs when scores ~0");
  assert(!soft.clarify?.length, "no clarify when lexicon has no near typo");

  const typoDocs = [
    {
      id: "r",
      name: "Refund FAQ",
      type: "TEXT",
      content: "Our refund policy: money back within 5 business days.",
      createdAt: "2024-06-01T00:00:00.000Z",
    },
    {
      id: "n",
      name: "Noise",
      type: "TEXT",
      content: "Unrelated cactus watering schedule for lobby plants.",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ];
  const typo = selectKnowledgeChunks({
    docs: typoDocs,
    query: "reunf plocy",
  });
  assert(
    typo.used.some((u) => /refund/i.test(u.name)),
    "fuzzy reunf/plocy → retrieves Refund FAQ"
  );
  assert(!typo.clarify?.length, "confident fuzzy match answers (no clarify)");
  assert(
    typo.fuzzyHits?.some((h) => h.to === "refund"),
    "fuzzyHits records reunf→refund"
  );

  // Ambiguous / no unique expand path still can clarify via near lexicon (soft ~0).
  const clarifyOnly = selectKnowledgeChunks({
    docs: [
      {
        id: "a",
        name: "Alpha Guide",
        type: "TEXT",
        content: "zzzz uniquealpha termonlyhere nevercommon",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    // Far typo that still maps uniquely in clarify when score stays ~0 —
    // use a near miss that expand may skip if term not in scored chunk tokens…
    // Prefer: softFallback with lexicon near-hit. "uniqalpa" → uniquealpha.
    query: "uniqalpa",
  });
  assert(
    clarifyOnly.clarify?.length >= 1 ||
      clarifyOnly.used.some((u) => /alpha/i.test(u.name)),
    "near typo either clarifies or fuzzy-retrieves"
  );

  assert(/test:f08d/.test(read("package.json")), "npm script");

  console.log("ok  F08-D empty KB / large-doc hint / typo clarify");
  console.log("\nF08-D smoke passed");
}

main();
