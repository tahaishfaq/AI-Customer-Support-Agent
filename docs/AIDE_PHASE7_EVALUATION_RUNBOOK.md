# AIDE Phase 7 — Evaluation and rollout runbook

Phase 7 uses this order:

```text
local regression → staging sandbox → shadow read-only → authorized cohort → gradual expansion
```

Run the deterministic gate with:

```bash
npm run test:phase7-evaluation
npm run test:phase7-baseline
```

The first command checks store/web/general routing, knowledge evidence, customer-result binding, company-pack procedure confirmation, recovery metrics, duplicate-write blocking, shadow-write blocking, and emergency capability/company-pack switches. The second command writes `.tmp/phase7-local-baseline.md` and `.tmp/phase7-local-baseline.json` from the versioned sanitized seed suite.

The gate is fail-closed for unauthorized effects or disclosures, duplicate logical writes, recovery failures, and writes during shadow mode. Latency and quality targets are measured only when samples exist; a local pass is not a staging or production performance claim.

## Required staging evidence

Capture aggregate counts only: route accuracy, grounded-answer rate, citation correctness, recovery correctness, unauthorized effects/disclosures, duplicate writes, first-activity p95, simple-FAQ p95, tool-backed p95, and estimated cost. Do not store transcripts, credentials, raw provider payloads, or customer tokens in metrics.

Before enabling writes for a cohort, attach the gate result and rollback owner. If a security or replay blocker appears, disable the affected capability or company pack and keep safe FAQ/handoff available. Never use shadow mode to replay production writes.

The targets in `lib/evaluation/rollout-gate.js` are starting targets from the implementation plan, not current measurements or competitor benchmarks.

## Local-only decision

Staging is intentionally skipped. Local deterministic gates protect code and security contracts, but they cannot establish live provider latency, web availability, real cost, or production traffic behavior. Any live enablement remains an owner-controlled deployment decision.
