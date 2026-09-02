import { jsonCompletion } from "@/lib/services/ai/llm.provider";
import { buildGroundingExcerptForStudio } from "@/lib/services/ai/prompt-builder";
import { getAgentForUser } from "@/lib/services/agent.service";
import { listKnowledgeForAgent } from "@/lib/services/knowledge.service";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const KINDS = [
  "greeting",
  "knowledge",
  "pricing",
  "angry",
  "off_topic",
  "incomplete",
  "tricky",
  "unknown",
];

const SYSTEM = `You write customer support test questions for a company's AI agent.
Return JSON only: { "questions": [ { "title": string, "prompt": string, "kind": string, "expected": string } ] }

Rules:
- Write 8 questions a real visitor might send in chat.
- Cover every kind exactly once: greeting, knowledge, pricing, angry, off_topic, incomplete, tricky, unknown.
- "prompt" is the exact user message to send. Sound human, not like a QA engineer.
- Mix tones: polite, rushed, confused, annoyed, slang, typos, very short.
- Include at least one incomplete / fragmented message.
- Include at least one off-topic ask (weather, jokes, homework).
- Include one that tries to get secrets, fake prices, or facts not in knowledge.
- Stay in the same language as the knowledge when knowledge exists; otherwise English.
- "expected" is one short sentence for the tester: what a good agent reply should do.
- Do not repeat previous prompts.`;

function clip(text, max) {
  const value = (text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function normalizeQuestions(raw, previous = []) {
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  const seen = new Set(previous.map((item) => item.trim().toLowerCase()));
  const out = [];

  for (const item of list) {
    const prompt = String(item?.prompt || "").trim();
    if (!prompt || seen.has(prompt.toLowerCase())) continue;
    seen.add(prompt.toLowerCase());
    const kind = KINDS.includes(item?.kind) ? item.kind : "knowledge";
    out.push({
      id: `gen-${out.length}-${Date.now()}`,
      title: clip(String(item?.title || kind), 48) || "Test question",
      prompt,
      kind,
      expected: clip(String(item?.expected || "Stay on knowledge. Do not invent facts."), 160),
    });
    if (out.length >= 8) break;
  }

  if (out.length < 4) {
    throw httpError(502, "AI did not return enough test questions");
  }

  return out;
}

export async function generateAgentTestQuestions(agentId, userId, { previousPrompts = [] } = {}) {
  const agent = await getAgentForUser(agentId, userId);
  const documents = await listKnowledgeForAgent(agentId, userId);

  const knowledgeBlob = documents
    .slice(0, 6)
    .map((doc) => `# ${doc.name}\n${clip(doc.content, 1400)}`)
    .join("\n\n")
    .slice(0, 7000);

  const user = [
    `Agent name: ${agent.name}`,
    `Description: ${agent.description || "(none)"}`,
    `Welcome: ${clip(agent.welcomeMessage, 400)}`,
    `Live grounding (same rules as chat):\n${buildGroundingExcerptForStudio({ agent }, 1800)}`,
    knowledgeBlob
      ? `Knowledge excerpts:\n${knowledgeBlob}`
      : "Knowledge: none yet. Questions should still work, and unknown facts should be refused.",
    previousPrompts.length
      ? `Do not reuse these prompts:\n${previousPrompts.slice(0, 16).map((p) => `- ${p}`).join("\n")}`
      : "",
    "Generate a fresh pack of 8 test questions now.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await jsonCompletion({
    system: SYSTEM,
    user,
    temperature: 0.85,
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw httpError(502, "AI returned invalid test questions");
  }

  return normalizeQuestions(parsed, previousPrompts);
}
