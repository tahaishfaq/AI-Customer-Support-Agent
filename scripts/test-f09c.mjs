/**
 * F09-C contract smoke — recommended template UI + answerStyle field.
 * Run: npm run test:f09c
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECOMMENDED_ROLE_TEMPLATE,
  buildChatSystemPrompt,
  buildGroundingExcerptForStudio,
} from "../lib/services/ai/prompt-builder.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  const f09 = featureDoc(root, "F09");
  assert(/Phase C — Improvements ✅/.test(f09), "Phase C marked done");

  const schema = read("prisma/schema.prisma");
  assert(/answerStyle\s+String\s+@default\("DETAILED"\)/.test(schema), "answerStyle on Agent");

  const migration = read(
    "prisma/migrations/20260823120000_agent_answer_style/migration.sql"
  );
  assert(/answerStyle/i.test(migration), "migration adds answerStyle");

  const form = read("components/agents/AgentForm.jsx");
  assert(/RECOMMENDED_ROLE_TEMPLATE/.test(form), "form imports recommended template");
  assert(/useRecommendedTemplate|recommended grounding template/i.test(form), "checkbox UI");
  assert(/answerStyle/.test(form), "answer style select");

  const agentSvc = read("lib/services/agent.service.js");
  assert(/resolveAnswerStyle/.test(agentSvc), "agent service resolves answerStyle");
  assert(/answerStyle/.test(agentSvc), "persist answerStyle");

  const validation = read("lib/validations/agent.js");
  assert(/answerStyle.*SHORT.*DETAILED|enum\(\["SHORT", "DETAILED"\]\)/.test(validation), "zod answerStyle");

  const chat = read("lib/services/chat.service.js");
  assert(/agent\.answerStyle/.test(chat), "chat passes answerStyle");

  const packs = read("lib/services/test-questions.service.js");
  assert(/buildGroundingExcerptForStudio/.test(packs), "studio pack uses live grounding");

  const shortPrompt = buildChatSystemPrompt({
    agent: {
      systemPrompt: RECOMMENDED_ROLE_TEMPLATE,
      answerStyle: "SHORT",
    },
    replyLanguage: "english",
  });
  assert(/2–4 sentences|2-4 sentences/i.test(shortPrompt), "SHORT style in live prompt");

  const detailedPrompt = buildChatSystemPrompt({
    agent: {
      systemPrompt: RECOMMENDED_ROLE_TEMPLATE,
      answerStyle: "DETAILED",
    },
    replyLanguage: "english",
  });
  assert(/thorough when knowledge supports/i.test(detailedPrompt), "DETAILED style in live prompt");

  const excerpt = buildGroundingExcerptForStudio({
    agent: {
      systemPrompt: RECOMMENDED_ROLE_TEMPLATE,
      answerStyle: "SHORT",
    },
  });
  assert(excerpt.includes(RECOMMENDED_ROLE_TEMPLATE.slice(0, 40)), "studio excerpt has role");

  assert(/ANSWER_STYLE_OPTIONS|HYBRID/.test(form), "HYBRID in form options");

  const hybridPrompt = buildChatSystemPrompt({
    agent: {
      systemPrompt: RECOMMENDED_ROLE_TEMPLATE,
      answerStyle: "HYBRID",
    },
    replyLanguage: "english",
  });
  assert(/choose per message|hybrid/i.test(hybridPrompt), "HYBRID prompt rule");

  assert(/test:f09c/.test(read("package.json")), "npm script");

  console.log("ok  F09-C template UI + answerStyle");
  console.log("\nF09-C smoke passed");
}

main();
