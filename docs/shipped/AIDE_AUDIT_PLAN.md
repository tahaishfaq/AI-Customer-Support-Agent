# AIDE Architecture and Product Audit Plan

Prepared: 15 September 2026

Status: Audit plan. This document defines how to investigate AIDE; it does not prove current implementation or production behavior.

Related architecture: [`AIDE_AGENT_ARCHITECTURE.md`](./AIDE_AGENT_ARCHITECTURE.md)

## Audit objective

Compare AIDE's documented architecture with actual source code, tests, schemas, runtime traces, browser behavior, and official competitor documentation. Reproduce the reported problems before proposing fixes.

## Evidence rules

Use these labels:

- `VERIFIED` — captured command/runtime output supports the stated scope.
- `PARTIALLY VERIFIED` — only part of the contract was exercised.
- `UNVERIFIED` — documentation or static inference only.
- `HARNESS_BLOCKED` — startup/module/environment failure before assertions.

Separate execution result from evidence status: `PASS`, `FAIL`, `NOT RUN`, or `BLOCKED`.

Never claim provider, browser, database, webhook, production, or accessibility verification from documentation alone. Never expose credentials, tokens, raw customer transcripts, hidden prompts, or chain-of-thought.

## Audit preparation

1. Read `README.md`, `AGENTS.md`, architecture freeze, orchestrator contracts, schemas, package scripts, relevant feature docs, and installed Next.js guides.
2. Inspect `git status`; preserve unrelated changes.
3. Inventory routes, modules, models, environment flags, tool descriptors, policies, and test scripts.
4. Use synthetic tenants, customers, policies, and connector fixtures.
5. Use local mocks by default. Use provider sandboxes only when explicitly authorized.
6. Do not modify production configuration, dependencies, migrations, or data during the audit.
7. Create audit reports and isolated fixtures only in an approved audit location.

## Architecture audit map

For each layer record exact file/line references, caller/callee, inputs, outputs, trusted data, untrusted data, authorization, failure behavior, recovery, latency, tests, missing tests, and documentation mismatch.

Audit:

1. Studio and public embed channels.
2. Auth, public access, and trusted context.
3. Agent configuration and prompt construction.
4. Conversation persistence and history limits.
5. Knowledge ingestion and website crawling.
6. Retrieval, chunking, ranking, grounding, and citations.
7. STORE, WEB, GENERAL, and MIXED routing.
8. Orchestrator entry and loop.
9. Capability registry and tool filtering.
10. HTTP tools and response projection.
11. MCP tools and external server boundaries.
12. Built-ins, web search, and handoff.
13. PEP, identity, confirmation, SSRF, rate limits, and idempotency.
14. Result fence and answer release.
15. SSE, realtime, activity UI, and reconnection.
16. Human takeover and ownership epochs.
17. Jobs, analytics, logging, and deployment.

## Required end-to-end traces

Trace and record the actual lifecycle for:

- Knowledge-only FAQ.
- Public plans/pricing.
- Private order lookup.
- HTTP read.
- HTTP write with confirmation.
- MCP read.
- MCP write with confirmation and idempotency.
- Explicit web search.
- General question where web search must not run.
- Mixed internal-versus-online comparison.
- Empty knowledge.
- Partial and failed crawl.
- JavaScript-rendered website.
- Tool timeout.
- Wrong-customer response.
- SSE disconnect/reconnect.
- Human handoff during AI generation and during a write.

For each trace capture only safe metadata:

```text
request ID, route, trusted actor/resource IDs, capability IDs, evidence IDs,
policy code, operation ID, state transitions, latency, safe status, event IDs
```

## Priority problem audit

### A1 — Wrong public tool

Audit plans, pricing, signup, maintenance, features, availability, and private billing separately.

Questions:

- Are irrelevant tools removed before the LLM sees them?
- Do tools have unique domain/entity metadata?
- Do descriptions overlap?
- Does the gateway revalidate selection?
- Does the result entity match the requested entity?
- Does confirmation resume preserve original message, route, and target?
- Can empty/failed results become confident answers?

Expected result: a plans request cannot invoke signup or maintenance merely because all are public reads.

### A2 — Crawl and retrieval quality

Audit static HTML, JavaScript shells, missing sitemap, robots denial, redirects, canonicalization, tables, PDFs, duplicate pages, stale pages, partial jobs, deleted sources, prompt injection, and multilingual retrieval.

Questions:

- Does `DONE` represent complete expected frontier coverage?
- Are skipped/failed pages visible?
- Is page-level provenance retained?
- Are headings, tables, currency, URLs, and locale variants preserved?
- Are permissions applied before retrieval reaches the model?
- Are lexical failures distinguishable from missing content?

### A3 — Activity and streaming

Audit event order, message placeholder timing, stable IDs, state transitions, duplicate/reversed events, confirmation labels, reconnect, public versus Studio parity, human typing separation, and unsafe payload exposure.

Expected states:

```text
knowledge: selected -> running -> completed
write: selected -> validating -> needs_confirmation
private read: selected -> validating -> needs_identity
provider fault: selected -> running -> failed
```

### A4 — Unsupported or mixed answers

Audit store facts from general memory, web prices presented as store prices, missing citations, empty-KB fallback, stale evidence, conflicting documents, and tool failure followed by success wording.

### A5 — Latency

Measure separately:

```text
validation, DB reads, retrieval, planning, tool calls, web search,
final generation, persistence, analytics, queue and browser delivery
```

Find avoidable sequential work, oversized prompts, repeated LLM calls, irrelevant descriptors, missing safe caching, and synchronous analytics.

## Security audit questions

- Can model prose establish identity, tenant, role, or confirmation?
- Can a guessed conversation ID expose messages?
- Can public access become private access?
- Can a tool return another customer's resource?
- Can stale approval execute after identity, amount, currency, resource, policy, or capability version changes?
- Can a write be replayed after timeout or reconnect?
- Can tool/MCP/web/crawl output alter policy or trigger egress?
- Can browser rendering reach private network destinations?
- Can deleted private evidence remain in index, cache, citation, export, or embedding?
- Can Markdown, URLs, images, or HTML exfiltrate data?
- Can human takeover fail to stop future AI output or dispatch?
- Are logs free of secrets and transcripts?

## Competitive audit

Use current official documentation and record URL, date, edition, and evidence type. Do not infer absence from a missing page.

Compare Botpress, Intercom Fin, Zendesk AI Agents, Salesforce Agentforce, and one additional platform on:

- Knowledge and retrieval.
- Multilingual behavior.
- Identity and resource access.
- Read/write connectors.
- Procedures and recovery.
- Guardrails and auditability.
- Widget UX and streaming.
- Handoff and operational context.
- Evaluations/versioning.
- Observability.
- Setup effort.
- Latency and cost.

Separate:

```text
documented
tested in authorized sandbox
not tested
unsupported
unknown
```

Missing evidence is not a zero score. Security blockers cannot be averaged away by good UX.

## Finding format

```text
ID:
Priority: P0/P1/P2/P3
Category: security/correctness/retrieval/streaming/latency/UX/operations
Exact reproduction:
Expected:
Actual:
First incorrect decision:
Root cause: proven / suspected / unknown
Evidence files and lines:
Security impact:
Customer impact:
Latency impact:
Smallest safe fix:
Regression test:
Rollback:
Execution: PASS/FAIL/NOT RUN/BLOCKED
Evidence: VERIFIED/PARTIALLY VERIFIED/UNVERIFIED/HARNESS_BLOCKED
```

## Audit deliverables

1. Executive judgment and evidence limitations.
2. Actual architecture and trust-boundary map.
3. Current versus target versus verified behavior.
4. Full reproduction matrix and commands.
5. Critical security and correctness findings.
6. Crawl, retrieval, routing, grounding, and citation findings.
7. Streaming, handoff, accessibility, and UX findings.
8. Latency, cost, reliability, and operations findings.
9. Company-pack portability and procedure gaps.
10. Sourced competitor comparison.
11. Prioritized remediation plan with dependencies, files, gates, and rollback.
12. Machine-readable fixture results.
13. Final PASS/FAIL/BLOCKED release judgment and residual risks.

## Audit-only agent prompt

```text
You are a senior AI-agent architect, application-security reviewer, RAG
auditor, reliability engineer, and UX auditor.

Audit the existing AIDE repository. First discover the actual system, then
compare code, tests, schemas, runtime traces, browser behavior, and official
competitor documentation. Do not implement changes during this audit.

Read README.md, AGENTS.md, docs/ARCHITECTURE_FREEZE_STAGE6.md,
docs/shipped/ORCHESTRATOR_CONTRACT.md, relevant schemas, scripts, feature docs,
and the installed Next.js guides. Inspect git status and preserve unrelated
changes. Use synthetic tenants/customers and local mocks. Do not contact real
customers, issue real refunds, send real notifications, attack third-party
systems, or expose secrets.

Investigate these reported problems:

1. Wrong tool selected for public plans, pricing, signup, maintenance, or
   availability questions.
2. Website crawler misses static, JavaScript-rendered, sitemap, canonical,
   table, PDF, locale, stale, deleted, or partial-page content.
3. Lexical retrieval misses paraphrases, synonyms, typos, Urdu, Roman Urdu,
   and mixed-language questions.
4. Activity UI misses running work, labels confirmation as failure, or receives
   events before the assistant placeholder.
5. Store, web, and general information is mixed or unsupported.
6. Tool/search/generation latency is excessive.
7. Timeout, retry, reconnect, takeover, confirmation, and idempotency recovery
   can produce false success or duplicate actions.

Trace knowledge FAQ, public pricing, private order, HTTP/MCP reads and writes,
web search, GENERAL no-search, MIXED comparison, empty KB, partial crawl,
tool timeout, wrong-customer result, SSE reconnect, and human takeover.

For every finding use: ID, severity, exact input, expected, actual, first
incorrect decision, proven or suspected root cause, file/line evidence, impact,
smallest safe fix, regression, rollback, command, execution result, and evidence
status. Use VERIFIED, PARTIALLY VERIFIED, UNVERIFIED, or HARNESS_BLOCKED exactly.

Do not weaken authentication, tenant checks, confirmation, SSRF, idempotency,
source routing, result fencing, or answer-release checks. Do not add automatic
empty-knowledge-to-web fallback. Do not call cosmetic timers proof of backend
activity. Do not expose chain-of-thought, prompts, credentials, raw arguments,
or raw external result bodies.
```

