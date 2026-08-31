/**
 * F11 UX-2 smoke — capability catalog + ActionsForm wiring.
 * Run: node scripts/test-f11-ux2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPABILITY_GROUPS,
  badgesForCapability,
  listCapabilityCards,
  packIdsForGroup,
} from "../lib/actions/capability-catalog.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  assert(CAPABILITY_GROUPS.length >= 4, "catalog groups for Brandly + demo + verticals");
  const cards = listCapabilityCards();
  assert(cards.length >= 6, "at least Brandly+demo+ticket/booking/sub cards");
  assert(
    cards.some((c) => c.templateId === "create_support_ticket"),
    "ticket capability"
  );
  assert(
    cards.some((c) => c.templateId === "get_appointment"),
    "booking capability"
  );

  const ticket = cards.find((c) => c.id === "create_support_ticket");
  const badges = badgesForCapability(ticket);
  assert(badges.includes("Needs confirm"), "write card needs confirm badge");
  assert(badges.includes("Needs login"), "ticket needs login badge");

  const brandly = CAPABILITY_GROUPS.find((g) => g.id === "brandly");
  assert(packIdsForGroup(brandly).includes("brandly"), "brandly pack id");

  const form = read("components/customization/ActionsForm.jsx");
  const wizard = read("components/customization/UniversalBusinessWizard.jsx");
  const catalog = read("lib/actions/capability-catalog.js");
  assert(
    /testAgentAction/.test(form) && /\bTest\b/.test(form),
    "HTTP tools have one-click Test"
  );
  assert(
    /Install suggested tools/.test(wizard) && /handleInstall/.test(wizard),
    "Packs tab installs starter tools"
  );
  assert(
    /Needs confirm/.test(catalog) && /badgesForCapability/.test(catalog),
    "capability catalog exposes confirm/login badges"
  );

  const shipped = read("docs/SHIPPED_FEATURES.md");
  assert(/UX-2/.test(shipped), "SHIPPED documents UX-2");

  console.log("ok  UX-2 capability catalog");
  console.log("ok  ActionsForm catalog UI contracts");
  console.log("\nF11 UX-2 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF11 UX-2 smoke FAILED:", error.message);
  process.exit(1);
}
