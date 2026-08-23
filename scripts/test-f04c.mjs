/**
 * F04 Phase C smoke — motion, type scale, empty CTAs, admin tokens.
 * Run: npm run test:f04c
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
    /Phase C — Improvements ✅/.test(f04),
    "F04 Phase C should be marked done"
  );

  const css = read("app/globals.css");
  assert(/--text-sm:/.test(css) && /--text-xl:/.test(css), "type scale tokens");
  assert(/@keyframes message-in/.test(css), "message-in motion");
  assert(/@keyframes toast-in/.test(css), "toast-in motion");
  assert(/prefers-reduced-motion/.test(css), "reduced motion");
  assert(/\.cn-toast/.test(css), "toast Hapy chrome");

  const appShell = read("components/layout/AppShell.jsx");
  assert(
    /key=\{pathname\}/.test(appShell) && /animate-page-in/.test(appShell),
    "AppShell page-in on route change"
  );
  const adminShell = read("components/admin/AdminShell.jsx");
  assert(
    /key=\{pathname\}/.test(adminShell) && /animate-page-in/.test(adminShell),
    "AdminShell page-in on route change"
  );

  const bubble = read("components/chat/MessageBubble.jsx");
  assert(/animate-message-in/.test(bubble), "MessageBubble message-in");

  const list = read("components/chat/MessageList.jsx");
  assert(/scrollIntoView/.test(list), "MessageList smooth scroll");

  assert(exists("components/ui/empty-state.jsx"), "EmptyState component");
  const empty = read("components/ui/empty-state.jsx");
  assert(/one-job empty|single primary CTA|F04-C/i.test(empty), "EmptyState purpose");

  const agents = read("components/agents/AgentList.jsx");
  assert(
    /EmptyState/.test(agents) && /New agent/.test(agents),
    "agents empty → New agent"
  );
  const knowledge = read("components/knowledge/KnowledgeList.jsx");
  assert(
    /EmptyState/.test(knowledge) && /Add knowledge/.test(knowledge),
    "knowledge empty → Add knowledge"
  );
  const studio = read("components/studio/AgentTestStudio.jsx");
  assert(/Run test/.test(studio), "studio Run test CTA");

  const adminUsers = read("components/admin/AdminUsersDirectory.jsx");
  assert(/py-2\.5/.test(adminUsers), "admin denser rows");
  assert(
    /bg-\[var\(--color-surface\)\]/.test(adminUsers),
    "admin uses surface token"
  );
  assert(/--color-primary/.test(adminUsers), "admin keeps Hapy primary");

  console.log("ok  F04-C motion + type scale");
  console.log("ok  empty CTAs + admin density");
  console.log("\nF04-C smoke passed");
}

main();
