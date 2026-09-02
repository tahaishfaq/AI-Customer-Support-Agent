/**
 * P1 W3-1 — fair multi-doc knowledge packing + cited WEB sources.
 * Run: npm run test:p01-w3-1
 */
import {
  MAX_CHUNKS_PER_DOC,
  MAX_KNOWLEDGE_CHARS,
  selectKnowledgeChunks,
} from "../lib/services/ai/knowledge-retrieve.js";

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function main() {
  const refundDoc = {
    id: "refund",
    name: "Refund FAQ",
    type: "TEXT",
    content:
      "Unique refund token REFUND30. Refund policy: returns within 30 days. ".repeat(
        60
      ),
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  const shippingDoc = {
    id: "ship",
    name: "Shipping Guide",
    type: "TEXT",
    content:
      "Unique shipping token SHIP35. Shipping times: 3–5 business days domestic. ".repeat(
        60
      ),
    createdAt: "2024-01-02T00:00:00.000Z",
  };
  const webDoc = {
    id: "web",
    name: "Pricing page",
    type: "WEB",
    sourceUrl: "https://acme.com/pricing",
    content: "Pro plan costs $49 per month. ".repeat(40),
    createdAt: "2024-01-03T00:00:00.000Z",
  };

  const both = selectKnowledgeChunks({
    docs: [refundDoc, shippingDoc],
    query: "refund and shipping times",
    maxChars: MAX_KNOWLEDGE_CHARS,
  });
  assert(both.text.length <= MAX_KNOWLEDGE_CHARS, "within char budget");
  assert(both.used.length >= 2, "uses at least two docs");
  assert(/Refund FAQ \(TEXT\)/.test(both.text), "cited refund title");
  assert(/Shipping Guide \(TEXT\)/.test(both.text), "cited shipping title");
  assert(/REFUND30/.test(both.text) && /SHIP35/.test(both.text), "both doc tokens");

  const web = selectKnowledgeChunks({
    docs: [webDoc],
    query: "pro plan price",
  });
  assert(
    /Pricing page \(WEB\) — https:\/\/acme.com\/pricing/.test(web.text),
    "WEB source URL in heading"
  );

  const hugeSingle = selectKnowledgeChunks({
    docs: [
      {
        id: "mono",
        name: "Only doc",
        type: "TEXT",
        content: "alpha beta gamma. ".repeat(500),
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "tiny",
        name: "Tiny FAQ",
        type: "TEXT",
        content: "Tiny FAQ mentions beta gamma summary.",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ],
    query: "beta gamma policy",
    maxChars: 3000,
  });
  assert(/Tiny FAQ \(TEXT\)/.test(hugeSingle.text), "second doc not dropped");

  assert(MAX_CHUNKS_PER_DOC === 4, "per-doc cap constant");

  console.log("ok  fair multi-doc packing");
  console.log("ok  cited titles + WEB source URL");
  console.log("\nP1 W3-1 smoke passed");
}

main();
