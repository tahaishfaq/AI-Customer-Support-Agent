import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "scripts");

const MAP = [
  ["docs/features/F01_ERROR_HANDLING_OBSERVABILITY.md", "F01"],
  ["docs/features/F02_PRODUCTION_OPS_BOTTLENECKS.md", "F02"],
  ["docs/features/F03_PRODUCTION_TESTING_CI.md", "F03"],
  ["docs/features/F04_HAPY_DESIGN_IDENTITY.md", "F04"],
  ["docs/features/F05_AGENT_TEST_IMPROVEMENTS.md", "F05"],
  ["docs/features/F06_ADMIN_SECURITY.md", "F06"],
  ["docs/features/F07_ADMIN_PLATFORM_IMPROVEMENTS.md", "F07"],
  ["docs/features/F08_KNOWLEDGE_RETRIEVAL.md", "F08"],
  ["docs/features/F09_PROMPTS_GUIDANCE.md", "F09"],
];

const importLine =
  'import { featureDoc } from "./lib/shipped-doc.mjs";\n';

for (const file of fs.readdirSync(scriptsDir)) {
  if (!file.startsWith("test-f0") || !file.endsWith(".mjs")) continue;
  const full = path.join(scriptsDir, file);
  let src = fs.readFileSync(full, "utf8");
  let changed = false;

  for (const [oldPath, fid] of MAP) {
    const oldRead = `read("${oldPath}")`;
    const newRead = `featureDoc(root, "${fid}")`;
    if (src.includes(oldRead)) {
      src = src.split(oldRead).join(newRead);
      changed = true;
    }
  }

  if (src.includes('docs/features/F01_ERROR_HANDLING_OBSERVABILITY.md')) {
    src = src.replace(
      /docs\/features\/F01_ERROR_HANDLING_OBSERVABILITY\.md/g,
      "docs/SHIPPED_FEATURES.md"
    );
    changed = true;
  }

  if (changed) {
    if (!src.includes('from "./lib/shipped-doc.mjs"')) {
      const insertAt = src.indexOf("\n\nfunction assert");
      if (insertAt > 0) {
        src = `${src.slice(0, insertAt)}\n${importLine}${src.slice(insertAt)}`;
      }
    }
    fs.writeFileSync(full, src);
    console.log("patched", file);
  }
}

console.log("done");
