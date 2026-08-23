/**
 * F09-A contract smoke — prompts & guidance scope & identity.
 * Run: npm run test:f09a
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
  const f09 = featureDoc(root, "F09");
  assert(/Phase A — Scope & identity ✅/.test(f09), "Phase A marked done");
  assert(
    /central prompt builders|template sections|short\/long/i.test(f09),
    "Phase A in-scope"
  );
  assert(/Guidance CMS|fine-tun|model garden|F10/i.test(f09), "outs listed");
  assert(/Non-goals \(banned in F09\)/.test(f09), "non-goals section");
  assert(
    /Answer-from-knowledge|Clarify path|One LLM provider/.test(f09),
    "identity guardrails"
  );
  assert(/Changing F08 chunk|Embeddings \/ RAG/i.test(f09), "F08/F10 bans");

  const schema = read("prisma/schema.prisma");
  assert(
    !/model Guidance|model PromptVersion/i.test(schema),
    "no Guidance CMS tables"
  );

  const pkg = read("package.json");
  assert(/test:f09a/.test(pkg), "npm run test:f09a");

  const f08 = featureDoc(root, "F08");
  assert(/F08 A–H ✅|test:f08/.test(f08), "F08 still shipped prerequisite");

  console.log("ok  F09-A scope & identity");
  console.log("\nF09-A smoke passed");
}

main();
