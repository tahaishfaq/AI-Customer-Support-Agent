/**
 * F08-A contract smoke — knowledge retrieval scope & identity.
 * Lexical F08 path remains; Level 3 · L1 may add opt-in KnowledgeChunk/pgvector.
 * Run: npm run test:f08a
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  assert(/Phase A — Scope & identity ✅/.test(f08), "Phase A marked done");
  assert(
    /chunk select|keyword|overlap|token budget/i.test(f08),
    "Phase A in-scope: lexical stuffing"
  );
  assert(
    /Out:.*embeddings|F10/i.test(f08) && /Pinecone|pgvector/i.test(f08),
    "vectors historically out of F08 → F10 / Level 3"
  );
  assert(/Non-goals \(banned in F08\)/.test(f08), "non-goals section");
  assert(/embeddings/i.test(f08) && /KnowledgeChunk/i.test(f08), "bans listed");
  assert(/LLM re-rank|re-rank/i.test(f08), "no re-rank LLM");
  assert(/> 40|80k|F10 threshold/i.test(f08), "F10 threshold documented");
  assert(
    /Workspace \/ agent isolation|Cite titles|No vector infra/.test(f08),
    "identity guardrails"
  );

  const schema = read("prisma/schema.prisma");
  // Level 3 · L1 may ship KnowledgeChunk + pgvector (opt-in per agent).
  // F08 still forbids third-party vector SaaS and keeps lexical retrieve.
  assert(!/"@pinecone-database/.test(read("package.json")), "no pinecone dep");
  if (/model KnowledgeChunk/.test(schema)) {
    assert(
      /Level 3|semantic RAG|semanticRagEnabled/i.test(schema),
      "KnowledgeChunk must be Level 3 opt-in, not a silent F08 engine"
    );
  }

  const pkg = read("package.json");
  assert(/test:f08a/.test(pkg), "npm run test:f08a");

  console.log("ok  F08-A scope & identity");
  console.log("\nF08-A smoke passed");
}

main();
