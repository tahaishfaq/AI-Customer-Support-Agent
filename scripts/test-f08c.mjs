/**
 * F08-C contract smoke — WEB boost, dedupe, score floor.
 * Run: npm run test:f08c
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hostFromUrl,
  isNearDuplicate,
  jaccardTokens,
  selectKnowledgeChunks,
  tokenize,
} from "../lib/services/ai/knowledge-retrieve.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  const f08 = featureDoc(root, "F08");
  assert(/Phase C — Improvements ✅/.test(f08), "Phase C marked done");

  const mod = read("lib/services/ai/knowledge-retrieve.js");
  assert(/ORIGIN_HOST_BOOST/.test(mod), "origin host boost");
  assert(/isNearDuplicate|DEDUP_JACCARD/.test(mod), "dedupe");
  assert(/SCORE_FLOOR|MIN_RELATIVE_SCORE/.test(mod), "score floor");

  const chat = read("lib/services/chat.service.js");
  assert(
    /siteKnowledgeOrigin/.test(chat),
    "chat passes siteKnowledgeOrigin"
  );

  assert(hostFromUrl("https://www.example.com/path") === "example.com", "host parse");

  const noiseA = {
    id: "d1",
    name: "Office plants",
    type: "TEXT",
    content: "We water the office plants every Tuesday. Ferns like shade.",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  const noiseB = {
    id: "d2",
    name: "Visitor parking",
    type: "TEXT",
    content: "Visitor parking is on level B2. Bring your ticket to reception.",
    createdAt: "2024-01-02T00:00:00.000Z",
  };
  const refund = {
    id: "d3",
    name: "Refund FAQ",
    type: "TEXT",
    content:
      "Refund policy: customers may return items within 5 business days for a full refund.",
    createdAt: "2024-01-03T00:00:00.000Z",
  };

  const selected = selectKnowledgeChunks({
    docs: [noiseA, noiseB, refund],
    query: "What is the refund policy?",
  });
  assert(
    selected.used.some((u) => u.id === "d3"),
    "refund still selected"
  );
  assert(
    !selected.used.some((u) => u.id === "d1" || u.id === "d2"),
    "noise docs excluded when refund matches strongly"
  );

  const dupBody =
    "Store hours are 9am to 5pm Monday through Friday. Weekend hours are 10am to 2pm.";
  const web = {
    id: "w1",
    name: "Site hours",
    type: "WEB",
    content: "Our website lists support hours: Mon–Fri 9–5. Call from the contact page.",
    origin: "https://shop.example.com",
    sourceUrl: "https://shop.example.com/hours",
    createdAt: "2024-06-02T00:00:00.000Z",
  };
  const textHours = {
    id: "t1",
    name: "Hours note",
    type: "TEXT",
    content: "Internal note: desk covers email only. Website has public hours.",
    createdAt: "2024-06-01T00:00:00.000Z",
  };
  const sitePick = selectKnowledgeChunks({
    docs: [textHours, web],
    query: "What are the hours on your website?",
    siteKnowledgeOrigin: "https://shop.example.com",
  });
  assert(
    sitePick.used[0]?.id === "w1" || sitePick.text.includes("Site hours"),
    "WEB preferred for site-ish query with matching origin"
  );

  const dupA = {
    id: "dup1",
    name: "FAQ A",
    type: "TEXT",
    content: dupBody,
    createdAt: "2024-02-01T00:00:00.000Z",
  };
  const dupB = {
    id: "dup2",
    name: "FAQ B",
    type: "TEXT",
    content: dupBody,
    createdAt: "2024-02-02T00:00:00.000Z",
  };
  const deduped = selectKnowledgeChunks({
    docs: [dupA, dupB],
    query: "store hours monday friday",
  });
  assert(deduped.used.length === 1, "near-duplicate docs collapse to one used");
  assert(
    isNearDuplicate(
      { text: dupBody, tokens: tokenize(dupBody) },
      [{ text: dupBody, tokens: tokenize(dupBody) }]
    ),
    "isNearDuplicate helper"
  );
  assert(jaccardTokens(tokenize(dupBody), tokenize(dupBody)) === 1, "jaccard self");

  assert(/test:f08c/.test(read("package.json")), "npm script");

  console.log("ok  F08-C WEB boost / dedupe / score floor");
  console.log("\nF08-C smoke passed");
}

main();
