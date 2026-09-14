import "dotenv/config";
import assert from "node:assert/strict";

async function main() {
  if (process.env.OPENAI_WEB_SEARCH_PROBE !== "1") {
    console.log("SKIPPED_EXTERNAL: set OPENAI_WEB_SEARCH_PROBE=1 to call OpenAI hosted web search");
    return;
  }

  assert.equal(process.env.OPENAI_WEB_SEARCH_ENABLED, "true", "OPENAI_WEB_SEARCH_ENABLED=true is required");
  assert(process.env.OPENAI_API_KEY, "OPENAI_API_KEY is required");

  const { responsesTurn } = await import("../lib/services/ai/llm.provider.js");
  const result = await responsesTurn({
    system: "Answer briefly and cite the online source.",
    messages: [{
      role: "user",
      content: process.env.OPENAI_WEB_SEARCH_PROBE_QUERY || "Search online for the current OpenAI API documentation homepage.",
    }],
  });

  assert.equal(result.searchUsed, true);
  assert(result.content.length > 0);
  assert(result.sources.length > 0, "Hosted search returned no normalized sources");
  let streamProbe = null;
  if (process.env.OPENAI_WEB_SEARCH_PROBE_STREAM === "1") {
    const { responsesStreamTurn } = await import("../lib/services/ai/llm.provider.js");
    const events = [];
    const streamed = await responsesStreamTurn({
      system: "Answer briefly and cite the online source.",
      messages: [{
        role: "user",
        content: process.env.OPENAI_WEB_SEARCH_PROBE_QUERY || "Search online for the current OpenAI API documentation homepage.",
      }],
      onEvent: (event) => events.push(event.type),
    });
    assert(streamed.searchUsed, "Hosted streaming search was not used");
    assert(streamed.content.length > 0, "Hosted streaming search returned empty text");
    assert(streamed.sources.length > 0, "Hosted streaming search returned no sources");
    assert(events.includes("delta"), "Hosted streaming probe emitted no text deltas");
    assert(events.includes("search"), "Hosted streaming probe emitted no search lifecycle event");
    streamProbe = {
      eventTypes: [...new Set(events)],
      sourceCount: streamed.sources.length,
      citationCount: streamed.citations.length,
    };
  }
  console.log(JSON.stringify({
    status: "PASS",
    provider: "openai",
    model: process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-4.1-mini",
    searchUsed: result.searchUsed,
    sourceCount: result.sources.length,
    citationCount: result.citations.length,
    responseId: result.responseId,
    streamProbe,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
