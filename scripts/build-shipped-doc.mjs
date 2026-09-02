import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "docs/SHIPPED_FEATURES_TEST_APPENDIX.md");

const FEATURE_FILES = [
  "F01_ERROR_HANDLING_OBSERVABILITY.md",
  "F02_PRODUCTION_OPS_BOTTLENECKS.md",
  "F03_PRODUCTION_TESTING_CI.md",
  "F04_HAPY_DESIGN_IDENTITY.md",
  "F05_AGENT_TEST_IMPROVEMENTS.md",
  "F06_ADMIN_SECURITY.md",
  "F07_ADMIN_PLATFORM_IMPROVEMENTS.md",
  "F08_KNOWLEDGE_RETRIEVAL.md",
  "F09_PROMPTS_GUIDANCE.md",
];

const header = `# Test appendix (F01–F09) — for CI / \`npm run test:shipped\` only

Human-readable summary: [\`SHIPPED_FEATURES.md\`](SHIPPED_FEATURES.md)

---

`;

const parts = [header];
for (const name of FEATURE_FILES) {
  const rel = path.join("docs/features", name);
  const content = fs.readFileSync(path.join(root, rel), "utf8").trim();
  parts.push(content);
  parts.push("\n\n---\n\n");
}

fs.writeFileSync(outPath, parts.join("\n"));
console.log(`Wrote ${outPath} (${parts.length} sections)`);
