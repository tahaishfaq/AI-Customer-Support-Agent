/**
 * B5 — reply in the customer's language (explicit request > this message > earlier messages
 * > knowledge language). Run: npm run test:reply-language
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chooseReplyLanguage,
  detectLanguageRequest,
  detectMessageLanguage,
} from "../lib/services/ai/reply-language.js";
import { buildResponseRules } from "../lib/services/ai/prompt-builder.js";

test("message language: Roman Urdu, Urdu script, English", () => {
  for (const text of [
    "mujhe apna password reset karna hai, kaise karun?",
    "Meri return policy kya hai?",
    "Plans aur signup open hai?",
    "mera order kab tak aayega bhai",
    "Mera refund kab tak aayega?",
  ]) {
    assert.equal(detectMessageLanguage(text), "roman_urdu", text);
  }
  assert.equal(detectMessageLanguage("میرا آرڈر کہاں ہے؟"), "urdu");
  for (const text of [
    "How do I reset my password?",
    "Please tell me about your plans, ji", // one stray word stays English
    "yeh that works, thanks a lot",
    "What is the main difference between Pro and Starter?",
    "Can you do this for me today?",
  ]) {
    assert.equal(detectMessageLanguage(text), "english", text);
  }
});

test("too short to tell keeps the previous language", () => {
  for (const text of ["ok", "thanks", "hi", "🙂🙂", "", null, "ji haan"]) {
    assert.equal(detectMessageLanguage(text), null, String(text));
  }
});

test("explicit requests in English or Roman Urdu", () => {
  assert.equal(detectLanguageRequest("Can you reply in English please?"), "english");
  assert.equal(detectLanguageRequest("Roman Urdu mein jawab dein"), "roman_urdu");
  assert.equal(detectLanguageRequest("urdu mein batao"), "urdu");
  assert.equal(detectLanguageRequest("answer in roman urdu"), "roman_urdu");
  assert.equal(detectLanguageRequest("Do you support English and Urdu?"), null, "a question about languages is not a request");
  assert.equal(detectLanguageRequest("What is English pricing?"), null);
});

test("choice order: request > this message > earlier customer message > knowledge", () => {
  const history = [
    { role: "USER", content: "ok" },
    { role: "ASSISTANT", content: "Sure, here are the steps." },
    { role: "USER", content: "mujhe apna password reset karna hai" },
  ];
  // Short "ok" after Roman Urdu stays Roman Urdu (assistant text is ignored).
  assert.deepEqual(chooseReplyLanguage({ message: "ok", history, knowledgeLanguage: "english" }), { language: "roman_urdu", source: "customer" });
  // This message decides when it is long enough.
  assert.deepEqual(chooseReplyLanguage({ message: "How do I change my email address?", history, knowledgeLanguage: "urdu" }), { language: "english", source: "customer" });
  // An earlier explicit request holds even when the customer later types Roman Urdu.
  const withRequest = [{ role: "USER", content: "please reply in English" }, ...history];
  assert.deepEqual(chooseReplyLanguage({ message: "mera refund kab tak aayega?", history: withRequest }), { language: "english", source: "request" });
  // No signal at all → knowledge language (today's behaviour).
  assert.deepEqual(chooseReplyLanguage({ message: "hi", history: [], knowledgeLanguage: "urdu" }), { language: "urdu", source: "knowledge" });
  assert.deepEqual(chooseReplyLanguage({ message: "", history: null, knowledgeLanguage: "klingon" }), { language: "english", source: "knowledge" });
  // The current message inside history (newest-first persistence) is not counted twice.
  assert.equal(chooseReplyLanguage({ message: "ok", history: [{ role: "USER", content: "ok" }], knowledgeLanguage: "english" }).source, "knowledge");
});

test("prompt rule text: customer language vs the unchanged knowledge default", () => {
  const customer = buildResponseRules({ replyLanguage: "roman_urdu", languageSource: "customer" });
  assert.match(customer, /reply in Roman Urdu — the language the customer is writing in/);
  assert.match(customer, /business instructions above set a fixed reply language/);
  assert.doesNotMatch(customer, /Do not switch languages/);
  const requested = buildResponseRules({ replyLanguage: "english", languageSource: "request" });
  assert.match(requested, /the language the customer asked for/);
  // Default (no source) is byte-for-byte the previous knowledge rule.
  const legacy = buildResponseRules({ replyLanguage: "english" });
  assert.match(legacy, /^Reply language policy: always reply in English\. This language is chosen from the agent's knowledge bases/);
  assert.match(legacy, /Do not switch languages/);
});
