/**
 * F08-G contract smoke — lexical retrieve stays in-process; no Pinecone.
 * Level 3 · L1 may add KnowledgeChunk via additive migrations (not F08).
 * Run: npm run test:f08g
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
  assert(/Phase G — Infrastructure ✅/.test(f08), "Phase G marked done");
  assert(/No new DB|chunk at request|Migration.*None/i.test(f08), "no new DB");

  const migrationsDir = path.join(root, "prisma/migrations");
  const names = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir)
    : [];
  assert(
    !names.some((n) => /f08.*chunk/i.test(n)),
    "no F08 KnowledgeChunk migration folder"
  );

  const mod = read("lib/services/ai/knowledge-retrieve.js");
  assert(/KNOWLEDGE_MAX_CHARS/.test(mod), "env max chars");
  assert(/KNOWLEDGE_MAX_CHUNKS/.test(mod), "env max chunks");
  assert(/chunk at request|In-process only/i.test(mod), "request-time chunking");
  assert(!/embeddings\.create|openai\.embeddings/i.test(mod), "lexical module has no embeddings call");

  const pkg = read("package.json");
  assert(!/"@pinecone-database/.test(pkg), "no pinecone");
  assert(/test:f08g/.test(pkg), "npm script");

  const envEx = read(".env.example");
  assert(/KNOWLEDGE_MAX_CHARS/.test(envEx), ".env.example documents caps");

  console.log("ok  F08-G infrastructure (lexical path; Level 3 may add vectors)");
  console.log("\nF08-G smoke passed");
}

main();
