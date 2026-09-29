/**
 * Level 2 · P5 — agent versioning: snapshot, hash, changed fields, restore patch.
 * Run: npm run test:agent-revisions
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REVISION_FIELDS,
  changedFields,
  hashSnapshot,
  patchTouchesRevision,
  snapshotFromAgent,
  snapshotToPatch,
  stableStringify,
} from "../lib/agents/revisions.js";
import { updateAgentSchema } from "../lib/validations/agent.js";

const agent = {
  id: "a1",
  name: "Brandly",
  description: null,
  systemPrompt: "You are Brandly support.",
  answerStyle: "HYBRID",
  welcomeMessage: "Hi!",
  guidance: [{ id: "r1", title: "Refunds", when: "refund", then: "Ask for the order number.", enabled: true }],
  webSearchEnabled: false,
  customization: { appearance: { primaryColor: "#123456" } },
  // Not versioned: tools, crawl, keys, owner.
  actionsEnabled: true,
  publicKey: "pk_secret_like",
  userId: "u1",
};

test("snapshot holds only behaviour + appearance; defaults filled so equal agents hash equally", () => {
  const snapshot = snapshotFromAgent(agent);
  assert.deepEqual(Object.keys(snapshot).sort(), [...REVISION_FIELDS].sort());
  assert.ok(!JSON.stringify(snapshot).includes("pk_secret_like"), "keys never copied");
  assert.equal(snapshot.customization.appearance.primaryColor, "#123456");
  assert.ok(snapshot.customization.identity, "defaults merged");
  assert.equal(snapshot.description, "");
  assert.equal(hashSnapshot(snapshotFromAgent(agent)), hashSnapshot(snapshotFromAgent({ ...agent })));
  assert.equal(hashSnapshot(snapshotFromAgent({ ...agent, guidance: null })), hashSnapshot(snapshotFromAgent({ ...agent, guidance: [] })));
  assert.deepEqual(snapshotFromAgent(null).guidance, []);
});

test("stable hash ignores key order; any real change changes it", () => {
  assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }));
  // Live: validation turned home.status.url "" into null after a restore; still the same version.
  assert.equal(stableStringify({ url: "" }), stableStringify({ url: null }));
  assert.notEqual(stableStringify({ url: "" }), stableStringify({ url: "x" }));
  const base = hashSnapshot(snapshotFromAgent(agent));
  assert.notEqual(base, hashSnapshot(snapshotFromAgent({ ...agent, systemPrompt: "Changed" })));
  assert.notEqual(base, hashSnapshot(snapshotFromAgent({ ...agent, customization: { appearance: { primaryColor: "#000000" } } })));
  assert.equal(base, hashSnapshot(snapshotFromAgent({ ...agent, actionsEnabled: false })), "unversioned fields do not matter");
});

test("changed fields and which saves create a version", () => {
  const before = snapshotFromAgent(agent);
  const after = snapshotFromAgent({ ...agent, systemPrompt: "New", guidance: [] });
  assert.deepEqual(changedFields(before, after), ["systemPrompt", "guidance"]);
  assert.deepEqual(changedFields(null, after), []);
  assert.equal(patchTouchesRevision({ systemPrompt: "x" }), true);
  assert.equal(patchTouchesRevision({ guidance: [] }), true);
  assert.equal(patchTouchesRevision({ actionsEnabled: true, crawlRecrawlHours: 24 }), false);
  assert.equal(patchTouchesRevision(null), false);
});

test("restore patch passes the normal save validation and clears what the version did not have", () => {
  const patch = snapshotToPatch(snapshotFromAgent(agent));
  const parsed = updateAgentSchema.safeParse(patch);
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  assert.equal(parsed.data.description, null, "empty description clears it");
  const noGuidance = snapshotToPatch(snapshotFromAgent({ ...agent, guidance: null }));
  assert.deepEqual(noGuidance.guidance, [], "restoring a version without rules clears the rules");
  // An old/broken snapshot never sends empty required fields.
  const broken = snapshotToPatch({ systemPrompt: "", name: "", welcomeMessage: "", webSearchEnabled: true });
  assert.equal("systemPrompt" in broken, false);
  assert.equal("name" in broken, false);
  assert.equal(updateAgentSchema.safeParse(broken).success, true);
});
