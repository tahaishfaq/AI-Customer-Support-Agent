/**
 * Workspace URL slug contract.
 * Run: npm run test:workspace-slug
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultWorkspaceNameFromUser,
  slugify,
} from "../lib/utils/slugify.js";
import {
  sanitizeWorkspaceSlug,
  usableWorkspaceSlug,
  withWorkspaceSlug,
} from "../lib/workspace-path.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

assert.equal(slugify("Sami Afzal"), "sami-afzal");
assert.equal(defaultWorkspaceNameFromUser({ name: "Sami Afzal" }), "Sami Afzal");
assert.equal(defaultWorkspaceNameFromUser({ email: "sami@example.com" }), "sami");
assert.equal(usableWorkspaceSlug(""), null);
assert.equal(usableWorkspaceSlug("default-workspace"), "default-workspace");
assert.equal(sanitizeWorkspaceSlug(""), "workspace");
assert.equal(
  withWorkspaceSlug("/ws/default-workspace/agents/abc/customization", "sami-afzal"),
  "/ws/sami-afzal/agents/abc/customization"
);
assert.equal(
  `${withWorkspaceSlug("/ws/default-workspace/agents/abc/customization", "sami-afzal")}?tab=deploy`,
  "/ws/sami-afzal/agents/abc/customization?tab=deploy"
);

const proxy = read("proxy.js");
assert.match(proxy, /usableWorkspaceSlug/);
assert.doesNotMatch(proxy, /default-workspace/);

const switcher = read("components/layout/WorkspaceSwitcher.jsx");
assert.doesNotMatch(switcher, /\/ws\/default-workspace/);
assert.match(switcher, /hrefForWorkspaceSlug/);

const service = read("lib/services/workspace.service.js");
assert.match(service, /hydrateWorkspaceIdentity/);
assert.match(service, /defaultWorkspaceNameFromUser/);
assert.match(service, /WORKSPACE_SLUG_COOKIE/);

console.log("workspace-slug: ok");
