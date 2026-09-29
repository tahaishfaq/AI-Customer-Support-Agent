/**
 * B4 — a handoff batched with other tools waits until the answerable parts are answered,
 * unless the customer asked for a person. Run: npm run test:handoff-deferral
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFERRED_HANDOFF_RESULT,
  asksForHuman,
  customerWantsHuman,
  previousAssistantFromHistoryDesc,
  isHandoffCall,
  isShortYes,
  offeredHuman,
  previousAssistantText,
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

test("handoff alone: deferred once (offer the team), dispatched if the model insists", () => {
  // Live: "where is my order 88231?" was handed to a person without asking.
  assert.equal(shouldDeferHandoff([call("request_handoff")], byName, "where is my order 88231?"), true);
  assert.equal(shouldDeferHandoff([call("request_handoff")], byName, R48, { alreadyDeferred: true }), false, "second ask in the same turn");
  // Batched handoffs keep deferring every time (unchanged).
  assert.equal(shouldDeferHandoff([call("list_brandly_plans"), call("request_handoff")], byName, R48, { alreadyDeferred: true }), true);
});

test("yes to the team offer in the previous reply is a request for a person", () => {
  const offer = "I can't see order details here. Would you like me to connect you with our support team?";
  for (const yes of ["yes", "Yes please", "sure", "ok", "haan ji", "theek hai", "please do", "yes connect me"]) {
    assert.equal(isShortYes(yes), true, yes);
    assert.equal(shouldDeferHandoff([call("request_handoff")], byName, yes, { previousAssistant: offer }), false, yes);
  }
  // "Yes" without an offer, or a long message that starts with yes, is not consent to a handoff.
  assert.equal(shouldDeferHandoff([call("request_handoff")], byName, "yes", { previousAssistant: "Your plan renews monthly." }), true);
  assert.equal(isShortYes("yes but first tell me the price of the pro plan and the refund rules"), false);
  assert.equal(isShortYes("no thanks"), false);
  assert.equal(offeredHuman("Main aap ko team se connect kar sakta hoon?"), true);
  assert.equal(offeredHuman("Shall I transfer you to a human agent?"), true);
  assert.equal(offeredHuman("Here are our plans."), false);
  // Live replies that point to the team count as an offer (button shown, "yes" hands off).
  assert.equal(offeredHuman("Please reach out to our support team for assistance with your order status."), true);
  assert.equal(offeredHuman("Please contact our support team directly for help with order 88231."), true);
  assert.equal(offeredHuman("You can contact us by email at hello@acme.com."), false, "not a team offer");
  assert.equal(offeredHuman("I recommend contacting our support team directly."), true);
  assert.equal(offeredHuman("I recommend reaching out to our customer support team for details."), true);
  assert.equal(offeredHuman(null), false);
});

test("previous assistant text comes from history only", () => {
  const history = [
    { role: "user", content: "hi" },
    { role: "assistant", content: "Want me to connect you with our team?" },
    { role: "assistant", content: null, tool_calls: [] },
    { role: "user", content: "yes" },
  ];
  assert.equal(previousAssistantText(history), "Want me to connect you with our team?");
  assert.equal(previousAssistantText([]), "");
  assert.equal(previousAssistantText(null), "");
});

test("never deferred: explicit human asks, no handoff at all", () => {
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

test("[[NEED_HUMAN]] auto-handoff uses the same rule (live: order question handed off unasked)", () => {
  const historyDesc = [
    { role: "USER", content: "yes" },
    { role: "ASSISTANT", content: "I can't see orders here. Shall I connect you with our support team?" },
    { role: "USER", content: "where is my order 88231?" },
  ];
  const previous = previousAssistantFromHistoryDesc(historyDesc);
  assert.match(previous, /connect you with our support team/);
  assert.equal(customerWantsHuman("yes", previous), true, "yes to the offer");
  assert.equal(customerWantsHuman("where is my order 88231?", ""), false, "no ask → offer the button instead");
  assert.equal(customerWantsHuman("I want to talk to a human", ""), true);
  assert.equal(customerWantsHuman("yes", "Your order ships on Monday."), false, "yes to something else");
  assert.equal(previousAssistantFromHistoryDesc([{ role: "USER", content: "hi" }]), "");
  assert.equal(previousAssistantFromHistoryDesc(undefined), "");
});
