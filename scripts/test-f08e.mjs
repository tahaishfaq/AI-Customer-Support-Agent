/**
 * F08-E contract smoke — retrieve caps (chars / packed / scored).
 * Run: npm run test:f08e
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_CHUNKS_PACKED,
  MAX_CHUNKS_SCORED,
  MAX_KNOWLEDGE_CHARS,
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
  assert(/Phase E — Production bottlenecks ✅/.test(f08), "Phase E marked done");

  const mod = read("lib/services/ai/knowledge-retrieve.js");
  assert(/MAX_CHUNKS_SCORED\s*=\s*200/.test(mod), "score cap 200");
  assert(/MAX_CHUNKS_PACKED\s*=\s*12/.test(mod), "pack cap 12");
  assert(/MAX_KNOWLEDGE_CHARS\s*=\s*12_000/.test(mod), "char budget 12k");
  assert(/no embeddings|In-process only/i.test(mod), "no LLM retrieve");
  assert(/KNOWLEDGE_MAX_CHARS/.test(mod), "env override max chars");
  assert(/KNOWLEDGE_MAX_CHUNKS/.test(mod), "env override max chunks");
  assert(/KNOWLEDGE_MAX_CHUNKS_SCORED/.test(mod), "env override scored cap");

  assert(MAX_CHUNKS_SCORED === 200, "constant scored");
  assert(MAX_CHUNKS_PACKED === 12, "constant packed");
  assert(MAX_KNOWLEDGE_CHARS === 12_000, "constant chars");

  // 250 tiny docs → >200 chunks; still returns under budget, no throw.
  const docs = [];
  for (let i = 0; i < 250; i += 1) {
    docs.push({
      id: `d${i}`,
      name: `Doc ${i}`,
      type: "TEXT",
      content: `Paragraph about topic number ${i}. Unique token token${i} here.`,
      createdAt: new Date(2024, 0, 1, 0, 0, i).toISOString(),
    });
  }
  // Put refund only in the oldest docs (would be dropped if score-cap kept newest only
  // without matching tokens in newer set — newest includes token249 etc.)
  docs[0] = {
    id: "refund-old",
    name: "Refund FAQ",
    type: "TEXT",
    content:
      "Refund policy: customers may return items within 5 business days for a full refund.",
    createdAt: "2020-01-01T00:00:00.000Z",
  };

  const many = selectKnowledgeChunks({
    docs,
    query: "tell me about token249",
  });
  assert(many.text.length <= MAX_KNOWLEDGE_CHARS, "budget respected under load");
  assert(many.used.length <= MAX_CHUNKS_PACKED, "pack cap respected");
  assert(/token249|Doc 249/i.test(many.text), "newest scored chunks still searchable");

  const tight = selectKnowledgeChunks({
    docs: [
      {
        id: "a",
        name: "A",
        type: "TEXT",
        content: "alpha ".repeat(2000),
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "b",
        name: "B",
        type: "TEXT",
        content: "beta ".repeat(2000),
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ],
    query: "alpha beta",
    maxChars: 800,
  });
  assert(tight.text.length <= 800, "custom maxChars respected");

  assert(!/embeddings\.create|openai\.embeddings/i.test(mod), "no embeddings call");
  assert(/test:f08e/.test(read("package.json")), "npm script");

  console.log("ok  F08-E retrieve caps");
  console.log("\nF08-E smoke passed");
}

main();
