/**
 * B4 — a handoff batched with other tools waits until the answerable parts are answered,
 * unless the customer asked for a person. Run: npm run test:handoff-deferral
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFERRED_HANDOFF_RESULT,
  asksForHuman,
  isHandoffCall,
  shouldDeferHandoff,
} from "../lib/orchestrator/handoff-deferral.js";

const call = (name) => ({ id: `call_${name}`, function: { name, arguments: "{}" } });
const byName = new Map([
  ["request_handoff", { name: "request_handoff", _builtin: { id: "request_handoff" } }],
  ["handoff_alias", { name: "handoff_alias", _builtin: { id: "request_handoff" } }],
  ["list_brandly_plans", { name: "list_brandly_plans" }],
  ["web_search", { name: "web_search", _builtin: { id: "web_search" } }],
]);
const R48 = "What plans do you offer, how do I reset my password, and what is the weather in Karachi today?";

test("R48: handoff batched with other tools is deferred when no person was asked for", () => {
  assert.equal(shouldDeferHandoff([call("list_brandly_plans"), call("request_handoff")], byName, R48), true);
  assert.equal(shouldDeferHandoff([call("request_handoff"), call("web_search"), call("list_brandly_plans")], byName, R48), true);
  assert.equal(shouldDeferHandoff([call("list_brandly_plans"), call("handoff_alias")], byName, R48), true, "matched by built-in id");
});

test("never deferred: handoff alone, explicit human asks, no handoff at all", () => {
  assert.equal(shouldDeferHandoff([call("request_handoff")], byName, R48), false, "alone = model found nothing else to do");
  assert.equal(shouldDeferHandoff([call("list_brandly_plans")], byName, R48), false);
  assert.equal(shouldDeferHandoff([], byName, R48), false);
  assert.equal(shouldDeferHandoff(null, byName, R48), false);
  for (const ask of [
    "I want a human",
    "talk to a real person please",
    "My order arrived damaged, please connect me with a person from your team",
    "can I speak to someone from support team",
    "transfer me to an agent",
    "let me talk to your manager",
  ]) {
    assert.equal(asksForHuman(ask), true, ask);
    assert.equal(shouldDeferHandoff([call("list_brandly_plans"), call("request_handoff")], byName, ask), false, ask);
  }
});

test("ordinary questions are not human requests", () => {
  for (const text of [R48, "how do I connect my GitHub?", "who is the team behind AIDE?", "what is a support agent?", "", null]) {
    assert.equal(asksForHuman(text), false, String(text));
  }
});

test("deferred result is a valid tool message and handoff detection is safe without a map", () => {
  const parsed = JSON.parse(DEFERRED_HANDOFF_RESULT);
  assert.equal(parsed.status, "deferred");
  assert.equal(parsed.ok, false);
  assert.equal(isHandoffCall(call("request_handoff"), undefined), true);
  assert.equal(isHandoffCall(call("list_brandly_plans"), undefined), false);
  assert.equal(isHandoffCall({}, byName), false);
});
