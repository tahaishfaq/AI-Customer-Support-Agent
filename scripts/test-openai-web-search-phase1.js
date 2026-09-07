import assert from "node:assert/strict";
import fs from "node:fs";

const { dedupeSources, parseWebSearchEvent, parseWebSearchResponse } = await import("../lib/services/ai/web-search-result.js");
const { getWebSearchModel, isHostedWebSearchAllowed, isHostedWebSearchDeploymentEnabled } = await import("../lib/services/ai/web-search-config.js");

function fixture(name) {
  return JSON.parse(fs.readFileSync(new URL(`./fixtures/openai-responses-web-search/${name}.json`, import.meta.url), "utf8"));
}

const success = parseWebSearchResponse(fixture("success"));
assert.equal(success.ok, true);
assert.equal(success.searchUsed, true);
assert.equal(success.responseId, "resp_fixture_001");
assert.equal(success.text, "The current status is available from the official source.");
assert.equal(success.citations.length, 1);
assert.equal(success.citations[0].itemId, "msg_fixture_001");
assert.equal(success.citations[0].outputIndex, 1);
assert.equal(success.citations[0].contentIndex, 0);
assert.equal(success.sources.length, 1);
assert.equal(success.sources[0].title, "Official source");
assert.equal(parseWebSearchResponse(fixture("malformed")).citations.length, 0);
assert.equal(dedupeSources([{ url: "https://example.com/a#x" }, { url: "https://example.com/a" }]).length, 1);
assert.deepEqual(parseWebSearchEvent({ type: "response.output_text.delta", delta: "Hello" }), { type: "delta", text: "Hello" });
assert.equal(parseWebSearchEvent({ type: "response.completed" }), null);

const previous = process.env.OPENAI_WEB_SEARCH_ENABLED;
delete process.env.OPENAI_WEB_SEARCH_ENABLED;
assert.equal(isHostedWebSearchDeploymentEnabled(), false);
assert.equal(isHostedWebSearchAllowed({ agentEnabled: true }), false);
process.env.OPENAI_WEB_SEARCH_ENABLED = "true";
assert.equal(isHostedWebSearchAllowed({ agentEnabled: true }), true);
assert.equal(isHostedWebSearchAllowed({ agentEnabled: false }), false);
assert.equal(getWebSearchModel(), "gpt-4.1-mini");
if (previous === undefined) delete process.env.OPENAI_WEB_SEARCH_ENABLED;
else process.env.OPENAI_WEB_SEARCH_ENABLED = previous;

console.log("OpenAI hosted web-search Phase 1 parser and rollout-gate tests passed");
