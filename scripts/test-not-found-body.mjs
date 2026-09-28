/**
 * B2 — wrong-subject tools are not offered, and a 200 "no such record" body is NO_RESULT.
 * Run: npm run test:not-found-body
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatToolResultForModel,
  isNotFoundBody,
  isNotFoundBodyText,
  safeToolErrorMessage,
} from "../lib/actions/tool-errors.js";
import { inferCapabilityEntities } from "../lib/capabilities/descriptor.js";
import { filterCapabilitiesForSourceRoute, routeSource } from "../lib/services/ai/source-policy.js";

const tool = (name, description, riskLevel = "READ") => {
  const action = { name, description, riskLevel };
  return { ...action, entities: inferCapabilityEntities(action) };
};
const campaignTool = tool("get_brandly_campaign_status", "Get the status of a Brandly campaign by campaign id");
const orderTool = tool("get_order_status", "Look up an order status by order number");
const plansTool = tool("list_brandly_plans", "List Brandly plans and pricing");
const helpTool = tool("search_brandly_help", "Search the Brandly help center");
const handoff = { name: "request_handoff", riskLevel: "READ", entities: [] };
const offered = (message, tools) =>
  filterCapabilitiesForSourceRoute(tools, routeSource(message)).map((t) => t.name);

test("not-found bodies: sentinel statuses without a real record", () => {
  assert.equal(isNotFoundBody({ id: "A12345", name: null, status: "UNKNOWN", niche: null, budgetUsd: null, matchedCreators: 0, brand: null }), true);
  assert.equal(isNotFoundBody({ found: false }), true);
  assert.equal(isNotFoundBody({ exists: false, id: "x" }), true);
  assert.equal(isNotFoundBody({ status: "not found" }), true);
  assert.equal(isNotFoundBody({ state: "NOT_FOUND", id: 9 }), true);
  assert.equal(isNotFoundBody({ data: { status: "missing" } }), true);
});

test("real records are never not-found, whatever their status", () => {
  assert.equal(isNotFoundBody({ id: "CAMP-100", name: "Summer Drop", status: "UNKNOWN" }), false);
  assert.equal(isNotFoundBody({ id: "CAMP-100", name: "Summer Drop", status: "ACTIVE" }), false);
  assert.equal(isNotFoundBody({ status: "UNKNOWN", items: [{ id: 1 }] }), false);
  assert.equal(isNotFoundBody({ status: "pending" }), false);
  assert.equal(isNotFoundBody({ status: 404 }), false, "numeric status is not a sentinel string");
  assert.equal(isNotFoundBody([]), false);
  assert.equal(isNotFoundBody([{ status: "UNKNOWN" }]), false, "arrays are lists, not a missing record");
  assert.equal(isNotFoundBody(null), false);
  assert.equal(isNotFoundBody("UNKNOWN"), false);
  assert.equal(isNotFoundBodyText('{"status":"UNKNOWN","name":null}'), true);
  assert.equal(isNotFoundBodyText("not json"), false);
  assert.equal(isNotFoundBodyText('[{"status":"UNKNOWN"}]'), false);
  assert.equal(isNotFoundBodyText(""), false);
  assert.equal(isNotFoundBodyText("{broken"), false);
});

test("NO_RESULT tells the model to say not found, without a status", () => {
  const out = JSON.parse(formatToolResultForModel({ ok: true, status: "NO_RESULT", httpStatus: 200, bodyText: "" }));
  assert.equal(out.noResult, true);
  assert.match(out.replyHint, /not found/i);
  assert.equal("body" in out, false, "no body for the model to read a status from");
  // Normal OK results and R10 error bodies are unchanged.
  const ok = JSON.parse(formatToolResultForModel({ ok: true, status: "OK", httpStatus: 200, bodyText: '{"name":"A"}' }));
  assert.equal(ok.noResult, undefined);
  assert.match(ok.body, /"name":"A"/);
  assert.match(safeToolErrorMessage({ ok: false, httpStatus: 200, bodyText: JSON.stringify({ error: "bad" }) }), /failed|error/i);
});

test("tool subjects: campaign tool is not offered for an order, and vice versa", () => {
  assert.deepEqual(campaignTool.entities, ["CAMPAIGN"]);
  assert.deepEqual(orderTool.entities, ["SUPPORT"]);
  const tools = [campaignTool, orderTool, helpTool, handoff];
  // R11: order question — campaign tool is gone, order tool stays.
  assert.deepEqual(offered("What is the status of my order #A12345?", tools).sort(), ["get_order_status", "request_handoff", "search_brandly_help"]);
  // Campaign question — order tool is gone, campaign tool stays.
  assert.ok(offered("What is the status of campaign CAMP-100?", tools).includes("get_brandly_campaign_status"));
  assert.ok(!offered("What is the status of campaign CAMP-100?", tools).includes("get_order_status"));
  // Both subjects in one question keep both tools.
  const both = offered("Is my order linked to campaign CAMP-100?", tools);
  assert.ok(both.includes("get_order_status") && both.includes("get_brandly_campaign_status"));
});

test("unchanged: no-subject tools, GENERAL-route campaign lookups, store-only stripping", () => {
  // "CAMP-200 status?" has no subject word and routes GENERAL: the campaign tool must stay offered.
  assert.equal(routeSource("what's the latest on CAMP-200?").route, "GENERAL");
  assert.ok(offered("what's the latest on CAMP-200?", [campaignTool, handoff]).includes("get_brandly_campaign_status"));
  // A plans (store-fact) tool is still stripped on a GENERAL ask, as before.
  assert.equal(routeSource("What is an API?").route, "GENERAL");
  assert.ok(!offered("What is an API?", [plansTool, handoff]).includes("list_brandly_plans"));
  // Tools with no entities are never filtered by subject.
  assert.ok(offered("What is the status of my order #A12345?", [helpTool]).includes("search_brandly_help"));
  // A campaign question is not a store fact (general knowledge about campaigns still allowed).
  assert.equal(routeSource("What is a marketing campaign?").route, "GENERAL");
});
