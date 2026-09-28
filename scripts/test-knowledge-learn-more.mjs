/**
 * Learn more: HTTPS sourceUrl links only; prompt addon lists those URLs.
 * Run: node --import ./scripts/register-aliases.mjs scripts/test-knowledge-learn-more.mjs
 */
import assert from "node:assert/strict";
import {
  knowledgeLearnMoreSystemAddon,
  knowledgeSourceLinks,
} from "../lib/services/ai/source-policy.js";

assert.deepEqual(knowledgeSourceLinks(null), []);
assert.deepEqual(knowledgeSourceLinks([]), []);
assert.deepEqual(
  knowledgeSourceLinks([{ name: "A", sourceUrl: "http://insecure.example/docs" }]),
  [],
  "http rejected"
);
assert.deepEqual(
  knowledgeSourceLinks([{ name: "A", sourceUrl: "javascript:alert(1)" }]),
  [],
  "non-https rejected"
);

const links = knowledgeSourceLinks([
  { name: "GitHub", sourceUrl: "https://ai-customer-support-agent-coral.vercel.app/docs/mcp-github" },
  { name: "Dup", sourceUrl: "https://ai-customer-support-agent-coral.vercel.app/docs/mcp-github" },
  { name: "FAQ", sourceUrl: "https://ai-customer-support-agent-coral.vercel.app/docs/faq" },
  { name: "No url" },
]);
assert.equal(links.length, 2);
assert.equal(links[0].name, "GitHub");
assert.match(links[0].sourceUrl, /\/docs\/mcp-github$/);

const addon = knowledgeLearnMoreSystemAddon(links);
assert.match(addon, /Learn more/i);
assert.match(addon, /\/docs\/mcp-github/);
assert.match(addon, /\/docs\/faq/);
assert.equal(knowledgeLearnMoreSystemAddon([]), "");

console.log("PASS test-knowledge-learn-more");
