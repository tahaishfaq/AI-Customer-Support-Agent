import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeSource } from "../lib/services/ai/source-policy.js";
import { aggregateEvaluationMetrics, evaluateRolloutGate, ROLLOUT_STAGES } from "../lib/evaluation/rollout-gate.js";
import { PHASE7_SEED_CASES, PHASE7_SEED_SUITE_VERSION } from "../lib/evaluation/seed-suite.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");
fs.mkdirSync(outDir, { recursive: true });
const evaluated = PHASE7_SEED_CASES.map((item) => ({
  ...item,
  ...(item.utterance ? { actualRoute: routeSource(item.utterance).route } : {}),
}));
const metrics = aggregateEvaluationMetrics(evaluated);
const gates = Object.fromEntries(
  Object.values(ROLLOUT_STAGES).map((stage) => [stage, evaluateRolloutGate(metrics, stage)])
);
const report = {
  suiteVersion: PHASE7_SEED_SUITE_VERSION,
  generatedAt: new Date().toISOString(),
  environment: "local-deterministic",
  stagingSkipped: true,
  liveProviderCalls: false,
  metrics,
  gates,
};
fs.writeFileSync(path.join(outDir, "phase7-local-baseline.json"), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "phase7-local-baseline.md"), `# Phase 7 local baseline\n\n- Suite: \`${PHASE7_SEED_SUITE_VERSION}\`\n- Environment: local deterministic\n- Staging: skipped by product decision\n- Live provider calls: no\n\n## Metrics\n\n\`\`\`json\n${JSON.stringify(metrics, null, 2)}\n\`\`\`\n\n## Gate\n\n- Local regression: **${gates.LOCAL_REGRESSION.status}**\n- Shadow read-only: **${gates.SHADOW_READ_ONLY.status}**\n- Authorized cohort: **${gates.AUTHORIZED_COHORT.status}**\n\nThis report is engineering evidence for deterministic contracts only. It is not a live latency, cost, or provider-availability measurement.\n`);
console.log(`Phase 7 local baseline written: ${path.join(outDir, "phase7-local-baseline.md")}`);
console.log(JSON.stringify({ suiteVersion: PHASE7_SEED_SUITE_VERSION, metrics, gates }, null, 2));
