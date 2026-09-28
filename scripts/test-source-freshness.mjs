/**
 * B3 — live-world questions (news, weather, results, market prices) route to web;
 * business questions that merely say "latest" stay where they were.
 * Run: npm run test:source-freshness
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { routeSource } from "../lib/services/ai/source-policy.js";

const route = (message, webSearchEnabled = true) => routeSource(message, { webSearchEnabled });

test("fresh world questions go to WEB with web search allowed", () => {
  for (const message of [
    "What is the latest news about OpenAI today?",
    "latest news on AI",
    "any breaking headlines?",
    "what's in the news today",
    "weather in Karachi today",
    "Will it rain tomorrow? what's the weather",
    "Who won the cricket match yesterday?",
    "live score of the final",
    "current price of bitcoin",
    "USD to PKR exchange rate",
    "gold price today",
  ]) {
    const decision = route(message);
    assert.equal(decision.route, "WEB", message);
    assert.equal(decision.mayInvokeWebSearch, true, message);
  }
});

test("fresh + business parts in one message is MIXED (both sources available)", () => {
  const decision = route("What plans do you offer, how do I reset my password, and what is the weather in Karachi today?");
  assert.equal(decision.route, "MIXED");
  assert.equal(decision.mayInvokeWebSearch, true);
  assert.equal(route("what is the exchange rate for my plan price?").route, "MIXED");
});

test("mandatory cases keep their routes (R01, R04, R41, R42, R47, R48)", () => {
  assert.equal(route("Ap ke latest plans kya hain?").route, "STORE");
  assert.equal(route("What is an API?").route, "GENERAL");
  assert.equal(route("What is an API?").mayInvokeWebSearch, false);
  assert.equal(route("Meri return policy kya hai?").route, "STORE");
  assert.equal(route("What is the price in an unknown currency?").route, "STORE");
  assert.equal(route("Can you diagnose my condition?").mayInvokeWebSearch, false);
  assert.equal(route("What is your return policy and search online for Shopify pricing?").route, "MIXED");
});

test("'latest' about the business is not a web ask", () => {
  for (const [message, expected] of [
    ["latest version of your app", "GENERAL"],
    ["show my latest invoice", "STORE"],
    ["What are the latest updates in AIDE?", "GENERAL"],
    ["what's the latest on my order?", "STORE"],
    ["who won the giveaway on your page?", "GENERAL"],
  ]) {
    assert.equal(route(message).route, expected, message);
    assert.equal(route(message).mayInvokeWebSearch, false, message);
  }
});

test("web search off: same route, but never a web tool", () => {
  assert.equal(route("weather in Karachi today", false).route, "WEB");
  assert.equal(route("weather in Karachi today", false).mayInvokeWebSearch, false);
  assert.equal(route("current price of bitcoin", false).mayInvokeWebSearch, false);
});

test("GitHub asks are unaffected by freshness words", () => {
  const decision = route("show the latest commits in my repository");
  assert.equal(decision.signals.wantsGithub, true);
  assert.equal(decision.route, "GENERAL");
});
