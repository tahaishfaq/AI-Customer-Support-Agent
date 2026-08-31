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
  // D0 redesign: light primary #0d7377 (legacy was #0b5f58); dark may use #0f766e
  assert(
    /--color-primary:\s*#(0d7377|0b5f58|0f766e)/i.test(css),
    "globals must keep Aide teal --color-primary (#0d7377 family)"
  );
  assert(
    /--font-display/i.test(css) && /--font-sans/i.test(css),
    "globals must keep display + sans font tokens"
  );
  const lightPrimary =
    css.match(/:root\s*\{[\s\S]*?--color-primary:\s*([^;]+)/)?.[1]?.trim() ||
    "";
  assert(
    !/#7c3aed/i.test(lightPrimary),
    "primary must not be purple"
  );

  const authPanel = read("components/auth/AuthVisualPanel.jsx");
  assert(
    /Aide/i.test(authPanel) &&
      (/--color-primary/.test(authPanel) ||
        /#0d7377|#0b5f58/i.test(authPanel)),
    "AuthVisualPanel should brand with Aide + primary teal"
  );

  console.log("ok  F04-A doc scope + surface files");
  console.log("ok  teal tokens still in globals.css");
  console.log("\nF04-A smoke passed");
}

main();
