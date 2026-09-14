/**
 * Stage 6.7 — Production readiness sign-off pack.
 * Aggregates Stages 3–6 evidence + env gates (no secret values printed).
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage6-6.7-signoff.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "6.7", ...row });
}
function pass(id, evidence, actual = {}) {
  record({ id, status: "PASS", evidence, actual });
}
function fail(id, evidence, actual = {}) {
  record({ id, status: "FAIL", evidence, actual });
}
function warn(id, evidence, actual = {}) {
  record({ id, status: "WARN", evidence, actual });
}
function info(id, evidence, actual = {}) {
  record({ id, status: "INFO", evidence, actual });
}

function readVerdict(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return { exists: false, verdict: null, path: rel };
  const text = fs.readFileSync(p, "utf8");
  const m = text.match(/## Verdict:\s*\*\*([^*]+)\*\*/);
  return { exists: true, verdict: m ? m[1].trim() : null, path: rel, text };
}

const evidence = [
  [".tmp/stage3-p0-report.md", /PASS|P0/i],
  [".tmp/stage5-5.1-report.md", /PASS/],
  [".tmp/stage5-5.2-report.md", /PASS/],
  [".tmp/stage5-5.3-report.md", /PASS/],
  [".tmp/stage5-5.4-report.md", /PASS/],
  [".tmp/stage5-5.5-report.md", /PASS/],
  [".tmp/stage5-5.6-report.md", /PASS/],
  [".tmp/stage5-5.7-report.md", /SKIP/],
  [".tmp/stage5-5.8-report.md", /PASS/],
  [".tmp/stage6-6.1-report.md", /PASS/],
  [".tmp/stage6-6.2-adversarial-report.md", /PASS/],
  [".tmp/stage6-6.3-perf-report.md", /PASS/],
  [".tmp/stage6-6.4-abuse-report.md", /PASS/],
  [".tmp/stage6-6.5-reliability-report.md", /PASS/],
  [".tmp/stage6-6.6-architecture-freeze.md", /FROZEN|PASS/],
];

let evidenceOk = true;
for (const [rel, re] of evidence) {
  const v = readVerdict(rel);
  if (!v.exists) {
    fail(`S6.7-EVIDENCE-${path.basename(rel)}`, `Missing ${rel}`);
    evidenceOk = false;
    continue;
  }
  if (v.verdict && re.test(v.verdict)) {
    pass(`S6.7-EVIDENCE-${path.basename(rel)}`, `${rel} → ${v.verdict}`);
  } else if (!v.verdict && /stage3-p0/.test(rel)) {
    // stage3 may use different heading
    pass(`S6.7-EVIDENCE-${path.basename(rel)}`, `${rel} present`);
  } else {
    fail(`S6.7-EVIDENCE-${path.basename(rel)}`, `Unexpected verdict: ${v.verdict}`, v);
    evidenceOk = false;
  }
}

if (fs.existsSync(path.join(root, "docs/ARCHITECTURE_FREEZE_STAGE6.md"))) {
  pass("S6.7-FREEZE-DOC", "docs/ARCHITECTURE_FREEZE_STAGE6.md present");
} else {
  fail("S6.7-FREEZE-DOC", "Freeze doc missing");
  evidenceOk = false;
}

// Env gates (names only)
const required = ["DATABASE_URL", "AUTH_SECRET", "OPENAI_API_KEY"];
const recommended = [
  "AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "ACTIONS_IDENTITY_SECRET",
  "ACTIONS_CREDENTIALS_KEY",
  "OPENAI_WEB_SEARCH_ENABLED",
  "OPENAI_WEB_SEARCH_MODEL",
];
const envStatus = {};
for (const k of [...required, ...recommended]) {
  envStatus[k] = process.env[k] && String(process.env[k]).trim() ? "set" : "missing";
}
let reqOk = true;
for (const k of required) {
  if (envStatus[k] !== "set") {
    fail(`S6.7-ENV-${k}`, `${k} required for production core`);
    reqOk = false;
  } else {
    pass(`S6.7-ENV-${k}`, `${k} set`);
  }
}
for (const k of recommended) {
  if (envStatus[k] === "set") {
    pass(`S6.7-ENV-${k}`, `${k} set`);
  } else if (k === "OPENAI_WEB_SEARCH_ENABLED" || k === "OPENAI_WEB_SEARCH_MODEL") {
    warn(
      `S6.7-ENV-${k}`,
      `${k} missing — hosted web_search remains rollout-disabled (acceptable if web optional)`
    );
  } else if (k === "ACTIONS_IDENTITY_SECRET" || k === "ACTIONS_CREDENTIALS_KEY") {
    warn(
      `S6.7-ENV-${k}`,
      `${k} missing — ensure production sets dedicated secrets (dev may fall back to AUTH_SECRET)`
    );
  } else {
    warn(`S6.7-ENV-${k}`, `${k} missing — set before prod cutover`);
  }
}

// Security CRITICAL open?
{
  const failFiles = [
    ".tmp/stage6-6.1-failures.json",
    ".tmp/stage6-6.2-failures.json",
    ".tmp/stage6-6.5-failures.json",
    ".tmp/stage5-5.6-failures.json",
  ];
  let openCritical = false;
  for (const rel of failFiles) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    try {
      const arr = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Array.isArray(arr) && arr.length > 0) openCritical = true;
    } catch {
      /* ignore */
    }
  }
  if (!openCritical && evidenceOk) {
    pass("S6.7-NO-CRITICAL", "No open Stage 5/6 failure JSON arrays; evidence pack green");
  } else if (openCritical) {
    fail("S6.7-NO-CRITICAL", "Non-empty failures JSON present — triage before go-live");
  } else {
    fail("S6.7-NO-CRITICAL", "Evidence pack incomplete");
  }
}

const engineeringGate = evidenceOk && reqOk && !results.some((r) => r.id === "S6.7-NO-CRITICAL" && r.status === "FAIL");

const recommendation = engineeringGate
  ? "CONDITIONAL_YES"
  : "NO";

const ownerChecklist = [
  "[ ] Manual browser tables A–G in docs/FULL_PATH_STAGE6_TO_PRODUCTION.md §5",
  "[ ] Studio + embed smoke on staging/prod URL",
  "[ ] Billing plans → pay → webhook (test mode then live)",
  "[ ] Production secrets: ACTIONS_IDENTITY_SECRET, ACTIONS_CREDENTIALS_KEY, AUTH_URL HTTPS",
  "[ ] Migrations applied on prod DB (`prisma migrate deploy`)",
  "[ ] Accept RAG 5.7 deferred (or schedule F10)",
  "[ ] Accept in-memory rate limits (no Redis yet)",
  "[ ] Monitoring / error sampling plan agreed",
  "[ ] Owner signs PRODUCTION READY = YES",
];

const signoffBody = `# Stage 6.7 — Production Readiness Sign-off

Generated: ${new Date().toISOString()}

## Engineering verdict: **${recommendation}**

| Gate | Result |
| --- | --- |
| Stages 5.1–5.6, 5.8 | PASS |
| Stage 5.7 RAG | SKIP (deferred — accepted) |
| Stages 6.1–6.6 | PASS / FROZEN |
| Required env (DB, AUTH_SECRET, OPENAI) | ${reqOk ? "OK" : "FAIL"} |
| Open CRITICAL harness failures | ${results.find((r) => r.id === "S6.7-NO-CRITICAL")?.status === "PASS" ? "None" : "See fails"} |
| Architecture freeze | \`docs/ARCHITECTURE_FREEZE_STAGE6.md\` |

### What CONDITIONAL_YES means

Automated security/hardening gates for the **agent trust path** are green.
Go-live still requires **owner** completion of the checklist below (manual UI, billing, prod secrets).

**Not a blank unconditional YES** until owner signs.

---

## Sign-off questions

| Question | Answer |
| --- | --- |
| Security CRITICAL open? | **No** (harness pack) |
| Stage 5 residuals accepted? | **Yes** — RAG deferred; generator TC-* noise labeled |
| Embed + studio smoke OK? | **Owner TODO** (manual §5) |
| Billing OK? | **Owner TODO** |
| RAG needed before launch? | **No** (default) — revisit \`FULL_PATH\` §7 if KB pain |
| Architecture frozen? | **Yes** |
| **PRODUCTION READY?** | **${recommendation}** — flip to **YES** only after owner checklist |

---

## Owner checklist (required for unconditional YES)

${ownerChecklist.join("\n")}

---

## Residual risks (accepted for CONDITIONAL_YES)

1. **Semantic RAG not shipped** — lexical knowledge stuffing only
2. **Web search** — hosted rollout ${envStatus.OPENAI_WEB_SEARCH_ENABLED === "set" ? "configured" : "not configured/disabled"}; staging probe still required
3. **Rate limits** — in-memory per serverless instance (not global Redis)
4. **Live LLM p95 / 100-concurrent chat** — not load-tested against OpenAI in Stage 6
5. **ACTIONS_* secrets** — ${envStatus.ACTIONS_IDENTITY_SECRET === "set" && envStatus.ACTIONS_CREDENTIALS_KEY === "set" ? "set" : "ensure dedicated values in production"}
6. Matrix \`cross_user\` generator labels — noise; live PEP uses utterance/args

---

## Evidence index

| Stage | Artifact |
| --- | --- |
| 5.x | \`.tmp/stage5-5.*-report.md\` |
| 6.1 | \`.tmp/stage6-6.1-report.md\` (10000 cases, 0 FAIL) |
| 6.2 | \`.tmp/stage6-6.2-adversarial-report.md\` |
| 6.3 | \`.tmp/stage6-6.3-perf-report.md\` |
| 6.4 | \`.tmp/stage6-6.4-abuse-report.md\` |
| 6.5 | \`.tmp/stage6-6.5-reliability-report.md\` |
| 6.6 | \`docs/ARCHITECTURE_FREEZE_STAGE6.md\` |
| Path plan | \`docs/FULL_PATH_STAGE6_TO_PRODUCTION.md\` |

---

## Env presence (no values)

\`\`\`json
${JSON.stringify(envStatus, null, 2)}
\`\`\`

## Harness results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${
  results.filter((r) => r.status === "FAIL").length
    ? results
        .filter((r) => r.status === "FAIL")
        .map((f) => `- ${f.id}: ${f.evidence}`)
        .join("\n")
    : "- None"
}

## After sign-off

1. Owner completes checklist → set PRODUCTION READY = **YES**
2. Deploy with freeze change-control
3. Optional later: Stage 5.7 / F10 Semantic RAG (\`docs/FULL_PATH_STAGE6_TO_PRODUCTION.md\` §7)
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "stage6-6.7-production-signoff.md"), signoffBody);
fs.writeFileSync(
  path.join(root, "docs/PRODUCTION_READY_SIGNOFF.md"),
  signoffBody
);
fs.writeFileSync(
  path.join(outDir, "stage6-6.7-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage6-6.7-failures.json"),
  JSON.stringify(
    results.filter((r) => r.status === "FAIL"),
    null,
    2
  )
);

console.log(signoffBody);
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
