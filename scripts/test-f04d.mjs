/**
 * F04 Phase D smoke — error/retry surfaces + Google click-to-load.
 * Run: npm run test:f04d
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
    /Phase D — Error handling ✅/.test(f04),
    "F04 Phase D should be marked done"
  );

  const google = read("components/auth/GoogleSignInButton.jsx");
  assert(
    !/Loading Google/.test(google),
    "must never show Loading Google… hole"
  );
  assert(/phase === "idle"/.test(google), "click-to-load idle phase");
  assert(/Connecting…/.test(google), "loading stays on button");
  assert(/Try Google again/.test(google), "error → try again");
  assert(/setPhase\("idle"\)/.test(google), "retry returns to idle");

  assert(exists("components/ui/inline-alert.jsx"), "InlineAlert");
  const alert = read("components/ui/inline-alert.jsx");
  const alertPrimitive = read("components/ui/alert.jsx");
  assert(
    /onRetry/.test(alert) && /role="alert"/.test(alertPrimitive),
    "alert + retry (InlineAlert → Alert role=alert)"
  );

  const shared = read("components/analytics/analytics-shared.jsx");
  assert(/reloadKey/.test(shared) && /reload:/.test(shared), "analytics reload");
  assert(/onRetry/.test(shared), "AnalyticsError onRetry");

  const workspace = read("components/analytics/WorkspaceAnalytics.jsx");
  assert(/onRetry=\{reload\}/.test(workspace), "workspace analytics retry");
  const board = read("components/analytics/AnalyticsBoard.jsx");
  assert(/onRetry=\{reload\}/.test(board), "agent analytics retry");
  const admin = read("components/admin/AdminPlatformAnalytics.jsx");
  assert(/onRetry=\{reload\}/.test(admin), "admin analytics retry");

  const dash = read("app/(app)/dashboard/page.jsx");
  assert(/InlineAlert/.test(dash) && /reloadKey/.test(dash), "dashboard retry");

  const inbox = read("components/conversations/ConversationsShell.jsx");
  assert(/Try again/.test(inbox) && /reloadKey/.test(inbox), "inbox retry");

  assert(exists("app/(app)/error.jsx"), "app error boundary");
  assert(exists("app/admin/(console)/error.jsx"), "admin error boundary");
  const appErr = read("app/(app)/error.jsx");
  assert(/Try again/.test(appErr) && /--color-primary/.test(appErr), "app error Aide");

  console.log("ok  F04-D Google click-to-load");
  console.log("ok  error + retry on polished surfaces");
  console.log("\nF04-D smoke passed");
}

main();
