/**
 * F08-B contract smoke — lexical chunk / score / select.
 * Run: npm run test:f08b
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_KNOWLEDGE_CHARS,
  chunkDocument,
  selectKnowledgeChunks,
  tokenize,
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
  assert(/Phase A — Scope & identity ✅/.test(f08), "Phase A done");
  assert(/Phase B — Design & functionality ✅/.test(f08), "Phase B marked done");

  assert(
    fs.existsSync(path.join(root, "lib/services/ai/knowledge-retrieve.js")),
    "knowledge-retrieve.js exists"
  );

  const chat = read("lib/services/chat.service.js");
  assert(/selectKnowledgeChunks/.test(chat), "chat wires selectKnowledgeChunks");
  assert(!/function buildKnowledgeBlock/.test(chat), "blind buildKnowledgeBlock removed");
  assert(/usedKnowledge/.test(chat), "usedKnowledge kept");
  assert(/detectKnowledgeLanguage\(knowledgeDocs\)/.test(chat), "language on full docs");

  // Tokenize drops stopwords, keeps content terms
  const tokens = tokenize("What is the refund policy please");
  assert(tokens.includes("refund") && tokens.includes("policy"), "tokenize keeps refund");
  assert(!tokens.includes("the") && !tokens.includes("is"), "tokenize drops stopwords");

  const noiseA = {
    id: "d1",
    name: "Office plants",
    type: "TEXT",
    content: "We water the office plants every Tuesday. Ferns like shade.",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  const noiseB = {
    id: "d2",
    name: "Parking map",
    type: "TEXT",
    content: "Visitor parking is on level B2. Bring your ticket to reception.",
    createdAt: "2024-01-02T00:00:00.000Z",
  };
  const refund = {
    id: "d3",
    name: "Refund FAQ",
    type: "TEXT",
    content:
      "Refund policy: customers may return items within 5 business days for a full refund. Contact support with your order id.",
    createdAt: "2024-01-03T00:00:00.000Z",
  };

  // Refund doc last in list — old stuffing would truncate noise first if huge;
  // lexical select must still pick refund for this query.
  const selected = selectKnowledgeChunks({
    docs: [noiseA, noiseB, refund],
    query: "What is the refund policy?",
    maxChars: MAX_KNOWLEDGE_CHARS,
  });

  assert(selected.text.length <= MAX_KNOWLEDGE_CHARS, "respects char budget");
  assert(/## Agent knowledge/.test(selected.text), "knowledge heading");
  assert(/Refund FAQ/.test(selected.text), "refund title in prompt");
  assert(/5 business days/.test(selected.text), "refund body stuffed");
  assert(
    selected.used.some((u) => u.id === "d3" && /refund/i.test(u.name)),
    "usedKnowledge includes refund doc"
  );
  assert(!/\.\.\.\(truncated\)/.test(selected.text), "no blind truncate suffix");

  // Chunker: oversized single doc → multiple chunks
  const big = {
    id: "big",
    name: "Big FAQ",
    type: "TEXT",
    content: Array.from({ length: 40 }, (_, i) => `Section ${i}. ${"word ".repeat(40)}`).join(
      "\n\n"
    ),
    createdAt: "2024-06-01T00:00:00.000Z",
  };
  const parts = chunkDocument(big);
  assert(parts.length > 1, "large doc yields multiple chunks");
  assert(parts.every((p) => p.chunkId.startsWith("big#")), "stable chunk ids");

  const pkg = read("package.json");
  assert(/test:f08b/.test(pkg), "npm run test:f08b");

  console.log("ok  F08-B chunk / score / select");
  console.log("\nF08-B smoke passed");
}

main();
