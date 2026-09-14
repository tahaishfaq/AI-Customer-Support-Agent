<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aide engineering instructions

Make sure each word in your output justifies its existence


## Prime directive
an


These instructions are the repository contract. Follow them before making code, configuration, schema, dependency, infrastructure, or documentation changes. Prefer a small, reversible, evidence-backed change over a broad refactor.

## Product and runtime

Aide is a Next.js full-stack AI customer-support and customer-insights product. It lets customers create agents, load knowledge, chat, customize and embed a webchat, hand conversations to humans, inspect analytics, and manage billing. It also contains admin, realtime, email, MCP, and agent-action surfaces.

The supported runtime is:

- Node.js 22 or newer.
- Next.js 16 App Router with React 19.
- JavaScript and JSX for application source. Do not introduce TypeScript source or new `.ts`/`.tsx` files unless the task explicitly requires an existing generated/vendor boundary. Existing generated Prisma files and `prisma.config.ts` are not permission to expand TypeScript usage.
- Prisma 7 with Neon PostgreSQL.
- Auth.js / NextAuth v5 for authentication.
- An always-on Node process started by `server.js`; the same process hosts Next.js and Socket.IO realtime services.
- npm as the package manager. Use the repository lockfile and `npm run` scripts. Do not switch to pnpm, yarn, bun, or ad-hoc dependency installation.

Read `README.md`, this file, the relevant feature document, and the relevant Next.js guide before implementation. Treat `docs/ARCHITECTURE_FREEZE_STAGE6.md` as the current security and trust-path authority until an explicit architecture-unfreeze decision is recorded.

## Scope and change discipline

Before editing:

1. Inspect the current implementation, tests, docs, and git status.
2. Identify the exact route, component, service, schema, migration, or worker boundary involved.
3. State assumptions when requirements are ambiguous. Do not invent product behavior, provider behavior, or production facts.
4. Check whether the requested change is allowed by the architecture freeze and current rollout plan.

While editing:

- Preserve existing user-facing content, data, routes, API contracts, and accessibility behavior unless the request changes them.
- Keep changes localized. Avoid drive-by formatting, unrelated renames, speculative abstractions, and dependency upgrades.
- Reuse existing utilities, validators, auth guards, rate-limiters, UI primitives, and service boundaries before adding new ones.
- Never edit generated output by hand when the source or generator can be changed instead.
- Never weaken an auth check, tenant boundary, confirmation step, SSRF defense, idempotency guard, result fence, rate limit, or audit event to make a test pass.
- Do not silently add fallbacks between knowledge, web search, general answers, or legacy providers. Routing decisions must remain explicit.
- Do not claim a check passed unless it actually ran and its final result was captured.

## Canonical architecture

The frozen trust path is:

```text
USER → AUTH → TRUSTED CONTEXT → ORCHESTRATOR → SOURCE ROUTER
     → POLICY PEP → TOOL GATEWAY → RESULT FENCE
     → ORCHESTRATOR → ANSWER
```

The security invariant is `DATA != AUTHORITY`: LLM output, retrieved knowledge, web pages, tool results, MCP results, and user-provided text never establish identity, tenant, permissions, confirmation, or allowlists.

Canonical boundaries:

| Concern | Canonical location |
| --- | --- |
| Auth/session | `auth.js`, `auth.config.js`, `lib/require-auth.js`, `lib/require-admin.js` |
| Tenant/workspace access | `lib/services/workspace.service.js`, `lib/app-access-gate.js` |
| Chat assembly | `lib/services/chat.service.js`, `lib/api/chat.js` |
| Orchestrator entry and loop | `lib/orchestrator/index.js`, `lib/orchestrator/loop.js` |
| Source routing | `lib/services/ai/source-policy.js` |
| Tool policy/gateway | `lib/actions/policy.js`, `lib/actions/invoke-tool.js` |
| Confirmation | `lib/services/confirmation.service.js` |
| Authz binding | `lib/actions/authz-binding.js` |
| Write idempotency | `lib/actions/write-idempotency.js` |
| Untrusted result fence | `lib/actions/untrusted-result.js` |
| HTTP/SSRF controls | `lib/actions/http-executor.js`, `lib/actions/ssrf.js` |
| Knowledge retrieval | `lib/services/ai/knowledge-retrieve.js` |
| Web search | `lib/actions/web-search.js` and its capability adapter |
| Prisma boundary | `lib/prisma.js`, `prisma/schema.prisma`, `prisma/migrations/` |
| Realtime gateway | `server.js`, `realtime-gateway/`, `lib/realtime/`, `workers/` |

Frozen operational defaults include a maximum of 3 tool steps, a 25-second tool-loop deadline, at most 2 concurrent outbound calls, an 8-second default HTTP timeout, a 12-second web-search timeout, 4,000-character loop result truncation, 12,000-character knowledge budget, 20 history messages, 10-minute confirmation TTL, and 15-minute write-idempotency TTL. Change these only with abuse, latency, and regression evidence.

## Security requirements

Every server-side request must establish the correct authority before performing work:

- Authenticate where required; authorize against the current workspace, agent, conversation, or public access token.
- Derive tenant and identity context from trusted server state, never from model prose, hidden fields, client claims, or retrieved content.
- Validate all request bodies, query parameters, route parameters, headers, webhook signatures, and tool arguments at the boundary.
- Scope every database read and write to the authorized tenant and resource. Check ownership before fetching sensitive details where practical.
- Keep admin routes and admin APIs behind the existing admin guard. Unauthorized admin access is intentionally not a normal user experience.
- Treat public embed routes as hostile input. Enforce origin/public-key rules, rate limits, conversation ownership, and end-user identity constraints.
- Keep secrets server-only. Never expose API keys, database URLs, auth secrets, raw credentials, reset tokens, or full provider payloads to the browser or logs.
- Sanitize and constrain LLM output before rendering. Render Markdown or HTML only through existing safe paths.
- Keep tool and web bodies fenced as untrusted data. They must not alter policy, identity, routing, confirmation, or system instructions.
- HTTP actions must retain SSRF protections, allowed protocols/hosts, timeouts, response-size limits, and redirect controls.
- WRITE actions and MCP writes require policy evaluation, actor/resource binding, explicit confirmation where applicable, one-shot consumption, and idempotency.
- Never log chat transcripts, credentials, tokens, or sensitive provider payloads. Use request IDs and stable error codes for correlation.
- Preserve fail-closed behavior. If authorization, configuration, verification, or routing is uncertain, deny or return a safe explicit state.

The LLM may request an allowlisted tool and draft final wording. It may not approve a write, invent a tool, change the subject or tenant, bypass policy, or convert untrusted content into authority.

## Database and migrations

- `DATABASE_URL` is for application traffic and should use the Neon pooled host.
- `DIRECT_URL` is for Prisma migrations and direct administrative operations.
- Use `prisma migrate dev` only for local migration development. Use `prisma migrate deploy` for staging/production.
- A schema change requires a reviewed migration, rollback/compatibility reasoning, and affected test updates. Do not edit an already-applied migration.
- Prefer additive, backward-compatible migrations for rolling deploys: add nullable/defaulted fields, deploy code that understands both shapes, backfill safely, then tighten constraints in a later migration.
- Do not run destructive production SQL, mass deletes, resets, or migration resets without explicit user authorization and a verified target.
- Keep seed files safe to rerun and never store production credentials in the repository. `prisma/admins.local.json` is local-only.
- Inspect generated Prisma changes after `npm run prisma:generate`; do not hand-edit `app/generated/prisma/`.

## API, actions, and errors

- Keep route handlers thin: parse input, establish authority, call a service, and return a deliberate response.
- Put reusable business logic in `lib/` services or API modules, not duplicated across route handlers and client components.
- Use stable status codes and machine-readable error codes. Do not leak stack traces or provider internals to clients.
- Preserve `x-request-id` behavior and structured failure logging. Include enough context to debug without logging sensitive payloads.
- Apply rate limits at the existing boundary appropriate to the route; do not assume per-instance in-memory limits are global.
- Maintain idempotency for retried writes, webhooks, billing events, email delivery, and other externally retried operations.
- For streaming/SSE, handle disconnects, aborts, timeouts, partial provider failures, and final persistence explicitly. Do not leave an orphaned active state.
- For webhooks, verify signatures before parsing trusted meaning, make handling idempotent, and return provider-compatible responses.

## UI and frontend

- Follow the existing shadcn/ui, Tailwind, and design-token conventions. Do not introduce a second component system for a local preference.
- Keep server/client boundaries intentional. Add `"use client"` only where browser state, event handlers, or client-only APIs require it.
- Keep secrets and privileged database/provider calls out of client modules.
- Preserve keyboard access, focus behavior, semantic labels, loading/error/empty states, reduced-motion behavior, and usable contrast.
- Test responsive behavior at narrow and wide viewports. Check both viewport edges, long labels, wrapping, and `scrollWidth`; do not hide an overflow bug behind a page-level horizontal scroll.
- Preserve deep links, URL tab/filter state, browser back/forward behavior, and refresh behavior when changing dashboard, inbox, analytics, agent, or billing UI.
- Keep embed UI isolated from host-page styles and globals.

## Testing and verification

Choose the smallest meaningful validation set, then expand it for risk:

```bash
npm run lint
npm run build
npm run test:product
npm run test:shipped
npm run test:full-suite
```

Use focused scripts from `package.json` for the changed feature. Security, realtime, billing, email, orchestrator, and stage validation scripts are contract tests, not optional decoration.

For scripts that import generated Prisma TypeScript through the repository alias setup, use the pinned local runner:

```bash
./node_modules/.bin/tsx --import ./scripts/register-aliases.mjs scripts/<test>.mjs
```

Do not replace this with unpinned `npx tsx`. A startup/module-resolution failure before assertions execute is `HARNESS_BLOCKED`, not a product PASS or FAIL. Record the exact command, result, and blocker.

For browser checks, verify the app is running on the actual configured port before interpreting a screenshot or Playwright result. `ERR_CONNECTION_REFUSED` is an environment failure, not visual-regression evidence. Install the required Playwright browser before running E2E. Report focused passes and broader baseline failures separately.

When adding a regression test, first reproduce the failure, then add the narrowest assertion that protects the contract. Include authorization-negative, malformed-input, retry/idempotency, timeout, and empty-state cases where relevant.

## Production operations

Before release:

- Review the diff and confirm no unrelated user changes are included.
- Run the relevant lint, build, unit/contract, integration, browser, security, and smoke checks.
- Confirm required production secrets exist in the deployment secret manager, with dedicated values for `AUTH_SECRET`, `ACTIONS_IDENTITY_SECRET`, `ACTIONS_CREDENTIALS_KEY`, provider keys, and webhook secrets.
- Confirm `AUTH_URL` and `NEXT_PUBLIC_APP_URL` are HTTPS production origins and `REALTIME_URL`/allowed origins match the deployment topology.
- Apply migrations with `prisma migrate deploy` before promoting code that depends on them.
- Confirm health, request IDs, structured errors, rate-limit behavior, provider timeouts, and graceful shutdown are observable.
- Verify login, agent creation, knowledge/chat, conversation desk, analytics, embed origin locking, admin authorization, billing/webhooks, email flows, and realtime behavior as applicable.
- Treat the current sign-off as conditional until owner/manual checklist items are completed. Do not call the product unconditionally production-ready based only on automated security harnesses.

Never print `.env`, secrets, tokens, customer data, or full database URLs. Rotate exposed credentials immediately and document the incident without copying secret values.

## Documentation and decision records

Update the narrowest relevant document when behavior or operations change. Important references include:

- `README.md` for setup, deployment, product map, smoke checks, and scripts.
- `docs/OPEN_SEQUENCE.md` and `docs/FULL_PATH_STAGE6_TO_PRODUCTION.md` for rollout order and remaining gates.
- `docs/ARCHITECTURE_FREEZE_STAGE6.md` for frozen trust-path rules and change control.
- `docs/PRODUCTION_READY_SIGNOFF.md` for current conditional/owner gates.
- `docs/features/` and `docs/shipped/` for feature contracts and shipped behavior.
- `.tmp/` for local validation reports when a script creates them; do not present ignored local reports as committed evidence.

If a change alters a frozen invariant, source route, authority boundary, schema contract, rollout gate, or production risk, record the decision and explicitly identify migration, rollback, and removal verification. Do not silently replace the architecture through a local patch.

## Git and handoff

- Inspect `git status` before and after work. Assume existing uncommitted changes belong to the user.
- Do not reset, checkout, clean, or delete unrelated work.
- Keep commits focused when the user asks for a commit or push. Exclude local-only files, secrets, generated noise, and unrelated changes.
- In the final handoff, state what changed, what was verified, what was not verified, and any remaining risk. Link relevant files and use exact command names.
- If blocked, state the concrete blocker and the next safe action. Do not mask it with a workaround that changes product semantics.
