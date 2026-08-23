/**
 * F04 Phase A smoke — scope & identity locked; surface files + teal tokens present.
 * Run: npm run test:f04a
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

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function main() {
  const f04 = featureDoc(root, "F04");
  assert(
    /Phase A — Scope & identity ✅/.test(f04),
    "F04 Phase A should be marked done"
  );
  assert(
    /auth/i.test(f04) &&
      /dashboard/i.test(f04) &&
      /agent studio/i.test(f04) &&
      /analytics/i.test(f04) &&
      /embed preview/i.test(f04) &&
      /admin shell/i.test(f04),
    "F04-A must list in-scope surfaces"
  );
  assert(
    /information architecture/i.test(f04) &&
      /dark-mode-as-default/i.test(f04),
    "F04-A must name out-of-scope IA redesign + dark-mode-as-default"
  );
  assert(
    /Teal CSS variables/i.test(f04) &&
      /Brand-first auth/i.test(f04) &&
      /Studio ≠ canvas|no.*canvas/i.test(f04),
    "F04-A identity guardrails"
  );
  assert(
    /Remove nav/i.test(f04) &&
      /one composition/i.test(f04) &&
      /CSS variables/i.test(f04),
    "F04-A must list brand tests"
  );
  assert(
    f04.includes("AuthVisualPanel") &&
      f04.includes("AgentStudioFrame") &&
      f04.includes("WorkspaceAnalytics") &&
      f04.includes("CustomizationPreview") &&
      f04.includes("AdminShell") &&
      f04.includes("app/globals.css"),
    "F04-A inventory must name surface files"
  );

  const surfaces = [
    "app/globals.css",
    "components/auth/AuthVisualPanel.jsx",
    "components/auth/LoginForm.jsx",
    "components/auth/GoogleSignInButton.jsx",
    "app/(app)/dashboard/page.jsx",
    "components/agents/AgentStudioFrame.jsx",
    "components/analytics/WorkspaceAnalytics.jsx",
    "components/customization/CustomizationPreview.jsx",
    "components/embed/PublicWebchat.jsx",
    "components/admin/AdminShell.jsx",
    "components/layout/AppShell.jsx",
  ];
  for (const rel of surfaces) {
    assert(exists(rel), `missing surface file: ${rel}`);
  }

  const css = read("app/globals.css");
  assert(
    /--color-primary:\s*#0b5f58/i.test(css),
    "globals must keep Hapy teal --color-primary #0b5f58"
  );
  assert(
    /--font-display/i.test(css) && /--font-sans/i.test(css),
    "globals must keep display + sans font tokens"
  );
  assert(
    !/#7c3aed/.test(css.match(/--color-primary:[^;]+/)?.[0] || ""),
    "primary must not be purple"
  );

  const authPanel = read("components/auth/AuthVisualPanel.jsx");
  assert(
    /Hapy/i.test(authPanel) && /--color-primary/.test(authPanel),
    "AuthVisualPanel should brand with Hapy + primary token"
  );

  console.log("ok  F04-A doc scope + surface files");
  console.log("ok  teal tokens still in globals.css");
  console.log("\nF04-A smoke passed");
}

main();
