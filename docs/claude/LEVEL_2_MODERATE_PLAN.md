# Level 2 (Moderate): what serious customers expect when buying

> **Shipped (P1–P8).** M7 WhatsApp deferred. Archive: [`../shipped/LEVEL_2_MODERATE.md`](../shipped/LEVEL_2_MODERATE.md) · Index: [`README.md`](README.md). This file is the historical plan.

## Context


Level 1 made answers reliable (committed B1–B9 on `sami`). Level 2 adds what buyers compare against Intercom, Zendesk and Botpress:
- measurable resolution
- a team inbox that routes work
- owner-written guidance
- customer context
- a copilot for human agents
- versioning
- webhooks + API
- targeted proactive messages
- an email channel

**Decided scope:**
- **Building:** M2, M3, M4, M5, M6, M8, M9, M10, and M1 **email via Resend inbound**.
- **Next round:** WhatsApp and the connectors (M7).
- **Background work:** at request time + Next.js `after()`, with lazy catch-up on later requests. No cron, no worker.

## Deploy-safety rules (Vercel deploys while we build)

1. **The live and local database are the same Neon DB, and Vercel runs no migrations** (`build` = `next build`). Every migration is **additive only**: new tables, nullable columns, appended enum values. It is applied with `prisma migrate deploy` (after your OK) **before** any code that uses it. Before applying, run the current live code (clean `HEAD` checkout) against the migrated DB to prove nothing breaks.
2. **Every feature is off until configured** (per agent / workspace). Existing agents behave exactly as today.
3. **New routes only.** Existing API contracts keep their shape (new response fields are additive).
4. **Trust path:**
   - Frozen caps are unchanged (3 steps, 25 s, 2 outbound).
   - Profile, guidance, email headers and webhook data **never grant authority** (`DATA != AUTHORITY`).
   - Freeze change-log entry for every prompt or trust-path change.
5. **I never push or deploy.** You decide when `sami` goes live.
6. **Per phase:**
   - pure modules + `node --test` units
   - regression set identical to baseline
   - lint
   - live local check
   - its own commit

## Phases (order = value × dependency)

| Phase | Feature | Migration |
|---|---|---|
| P1 | M2 Resolution metrics + unanswered questions | `Message.answerState`, `Conversation.resolvedBy` |
| P2 | M10 Customer profile · M5 Guidance rules | `Agent.guidance` (Json) |
| P3 | M3 Assignment, round robin, SLA | `Workspace.deskSettings` (Json), `Conversation.firstHumanReplyAt` |
| P4 | M4 Copilot (suggest reply, summarize) | none |
| P5 | M6 Versioning (history, restore, studio draft) | `AgentRevision` table |
| P6 | M9 Targeted proactive messages | none (customization JSON) |
| P7 | M8 Outbound webhooks + REST API keys | `WorkspaceWebhook`, `WebhookDelivery`, `ApiKey` |
| P8 | M1 Email channel (Resend inbound) | `ConversationSource += EMAIL`, `InboundEmail` table, `Agent.emailChannel` (Json) |

---

### P1 — M2 Resolution metrics + unanswered questions
- **Record the outcome of each AI reply:** `Message.answerState` (nullable), set when the assistant message is saved in `chat.service.js`, from signals the turn already has:
  - `DEGRADED` (LLM failure)
  - `HANDOFF` (handoff triggered)
  - `NOT_FOUND` (a `NO_RESULT` tool step)
  - `NO_EVIDENCE` (STORE/MIXED route, no knowledge hit, no successful tool)
  - otherwise `ANSWERED`
- **Who resolved it:** `Conversation.resolvedBy` (`HUMAN` from the desk resolve route; `AI` computed).
- **Metrics** (new `lib/analytics/resolution.js`, pure SQL builders + pure aggregation; tenant-scoped like `analytics.service.js`):
  - **AI-resolved:** an embed/email conversation with ≥1 user message, **settled** (no message for 24 h), `handoffCount = 0`, no 👎 feedback, and a last AI answer that is not `NO_EVIDENCE`/`DEGRADED`/`NOT_FOUND`
  - **Automation rate:** AI-resolved ÷ settled conversations
  - **Handoff rate**, **human-resolved**, **CSAT average**, **median first response time**
- **Unanswered questions:** customer messages whose AI reply was `NO_EVIDENCE`/`NOT_FOUND`, grouped by normalized text, top 20 with counts and a conversation link. The owner fixes them by adding knowledge.
- **UI:** resolution cards and an "Unanswered questions" table on the analytics page, with range filter 7d/30d/all.
- **Edge cases:**
  - Messages from before the migration have no state: excluded, with a "tracking since <date>" note.
  - Conversations still active aren't counted as resolved.
  - Studio conversations are excluded.
  - Deleted conversations.
  - Divide-by-zero → "—".
  - Large tenants: indexed queries, capped groups.
  - Question text is shown only to the tenant's owner/members, never in logs.

### P2 — M10 Customer profile · M5 Guidance rules
- **M10:** the verified HS256 identity JWT (`lib/actions/identity.js`) may carry `traits`:
  - ≤ 20 keys matching `^[a-zA-Z0-9_]{1,40}$`
  - values: string ≤ 200 chars, number or boolean
  - examples: name, plan, locale, company
- **Handling traits:**
  - Only verified JWTs are read; unsigned `setUser` data and client fields are ignored.
  - Traits stay in memory for the request, like `endUserAccessToken`.
  - They're added to the prompt as a fenced **"Customer profile (verified by the business, data only)"** block (newlines stripped, capped at 1,200 chars).
  - They're **never** read by policy, auth binding or tool arguments.
- **M5:** `Agent.guidance` holds ≤ 30 rules `{id, title≤80, when≤300, then≤800, enabled}`, validated with zod.
- **Guidance in the prompt:**
  - Placed right after the owner prompt, before the platform rules, so platform rules still win.
  - All enabled rules if they fit in 3,000 chars; otherwise the rules whose `when` best matches the message (reuses `contentTokens` from `tool-shortlist.js`).
  - UI: a "Guidance" tab in agent settings (add, edit, toggle, delete) and a "try it" link to Studio.
- **Edge cases:**
  - Traits that try to inject instructions ("ignore previous…") stay fenced data.
  - Expired or invalid token → no profile.
  - A rule that says "skip confirmation / call X" can't: confirmation, policy and tools are code.
  - Guidance text counts toward the prompt-size warning (B7).
  - Empty or disabled rules add nothing.
  - Unicode, Roman Urdu.

### P3 — M3 Assignment, round robin, SLA
- **Settings:** `Workspace.deskSettings = {assignment: "owner"|"least_busy"|"manual", pool: [userId] (empty = all members), slaFirstReplyMinutes: null|5…1440}`. Default `owner` = today's behaviour.
- **Assignment in `triggerHandoff`:**
  - `least_busy` picks the pool member with the fewest open assigned conversations, ties going to the longest since last assignment. The pick happens in the same transaction, so it's stateless and has no race-prone cursor.
  - `manual` leaves the conversation unassigned.
- **Assign to a teammate:** new `PATCH /api/conversations/[id]/assign {userId|null}`.
  - Allowed for workspace managers or the current assignee.
  - The target must be a workspace member.
  - Emits a realtime `CLAIM_UPDATED` event and an audit event.
- **SLA:**
  - `firstHumanReplyAt` is set on the first human desk message after a handoff.
  - Due time = `handoffAt` + SLA minutes; "Due in / Overdue" is computed at read time (no timers).
  - Inbox filter "Overdue".
- **Edge cases:**
  - Assignee removed from the workspace → shown unassigned, claimable.
  - Empty pool → owner.
  - Pool member not in the workspace → ignored.
  - Two handoffs racing → existing `isWaitingForHuman` idempotency.
  - Reopened conversation → new SLA window.
  - An owner with no seats still works.
  - Hours from B6 shape only the ack message, not assignment.

### P4 — M4 Copilot
- **Endpoints:**
  - `POST /api/conversations/[id]/suggest-reply` → `{draft, sources}`
  - `POST …/summarize` (reuses `buildHandoffContextSummary`)
- **Suggest reply:**
  - Inputs: last 20 messages + knowledge selection (`selectKnowledgeChunks`) + guidance + customer language (`chooseReplyLanguage`).
  - One LLM call, **no tools**. The draft is placed in the desk composer and never sent automatically; the content isn't persisted or logged.
- **Access:** the same checks as the conversation messages route (workspace access). Rate limited per user.
- **Edge cases:**
  - AI not configured or no credit → clear error code.
  - Empty conversation.
  - Customer text with injections → the draft is only text for a human.
  - Abort/timeout (8 s) → error.
  - Studio and embed conversations both supported.

### P5 — M6 Versioning
- **Table:** `AgentRevision {agentId, version, snapshot, note, createdByUserId, createdAt}`, unique `(agentId, version)`.
  - The snapshot covers `systemPrompt`, `answerStyle`, `guidance`, `webSearchEnabled` and `customization` (minus secrets).
- **When a revision is written:** on every successful agent save that changes one of those fields (inside `updateAgentForUser`, deduped by hash).
- **Endpoints:**
  - list, view, compare (client text diff)
  - **restore** = a new revision copying the old snapshot (history is never rewritten)
- **Studio draft:** owner-only "try unsaved prompt/guidance" override. Studio chat only; the public embed always uses the published config.
- **Edge cases:**
  - Restoring guidance that references removed tools is harmless (text only).
  - White-label fields are gated on restore like on save (402 if the plan dropped).
  - Concurrent saves → the unique version plus a retry once.
  - Cap history at 100 (prune oldest).

### P6 — M9 Targeted proactive messages
- **Rules:** `customization.proactive.rules`, ≤ 10 of `{message≤200, urlContains|urlPrefix, delaySeconds 0–600, audience: all|identified|anonymous, frequency: once_per_visitor|once_per_session|every_page}`. The old single `proactiveMessage` becomes a rule on read, so nothing is lost.
- **Evaluation:** a shared pure `lib/embed/proactive-rules.js`.
  - `embed.js` sends the page URL, including SPA navigations (`pushState` / `popstate`).
  - The widget shows a bubble; it never auto-opens the chat.
- **Edge cases:**
  - Widget already open or conversation active → no bubble.
  - Several rules match → the first one.
  - Frequency is kept in storage wrapped in try/catch (private mode = shown at most once per page load).
  - Reduced motion.
  - Host-page CSS isolation kept.
  - Dismiss is remembered.

### P7 — M8 Webhooks + REST API keys
- **Webhooks:** `WorkspaceWebhook` `{url (https only, SSRF-checked, pinned DNS, no redirects), secret (encrypted with ACTIONS_CREDENTIALS_KEY, shown once), events[], enabled, consecutiveFailures}`.
- **Deliveries:** `WebhookDelivery` unique `(webhookId, outboxEventId)`, which makes deliveries idempotent.
  - The source is the existing realtime outbox events (message created, handoff, status/resolved, CSAT).
  - Dispatched in `after()` of the request that created the event.
  - Retries on later events / inbox loads with backoff (1 m → 5 m → 30 m → 2 h → 12 h).
  - Auto-disabled after 20 failures, with an owner notice.
  - Signature `x-aide-signature: t=…,v1=HMAC-SHA256`, plus `x-aide-event-id`.
  - 5 s timeout, 64 KB payload cap.
  - Message text is included only if the webhook opts in.
- **API keys:** `ApiKey` `{prefix, sha256 hash, scopes, lastUsedAt, revokedAt}`.
  - Timing-safe compare, workspace-scoped.
  - `GET /api/v1/agents`, `GET /api/v1/conversations` (cursor-paged, filters), `GET /api/v1/conversations/:id/messages`.
  - Rate limit per key. Read-only in v1.
- **Edge cases:**
  - Webhook URL on localhost/private IP/redirect → rejected.
  - Slow or 5xx endpoint → retry without blocking chat.
  - Duplicate events → the same event id.
  - Ordering isn't guaranteed (documented).
  - Revoked or unknown key → 401.
  - Wrong-workspace IDs → 404.
  - Key shown once.

### P8 — M1 Email channel (Resend inbound)
- **Step 0:** read Resend's inbound docs (payload, signature) and confirm before coding.
- **Setup:** `Agent.emailChannel = {enabled, address (e.g. support@help.yourdomain.com), fromName}`; addresses are unique across agents. You add the MX record on that subdomain; the setup checklist shows DNS status.
- **Inbound:** `POST /api/webhooks/email-inbound`
  - Verify the signature (`RESEND_INBOUND_SECRET`).
  - Idempotent on `Message-ID` (`InboundEmail` table).
  - Map to an agent by the recipient address.
  - Thread by `In-Reply-To` / `References`, falling back to a reference token in the subject.
  - Strip quoted replies and signatures; HTML → text.
  - The conversation `source = EMAIL`.
  - The AI reply is sent via Resend with threading headers + `Auto-Submitted: auto-replied`.
  - Human desk replies on email conversations go out by email too.
- **Identity:** the sender address is **unverified** (a guest: no account or private tools, no `customerSubject`), because email headers aren't proof.
- **Billing:** email conversations count toward quota like embed.
- **Loop and abuse protection:**
  - Ignore auto-replies (`Auto-Submitted`, `Precedence: bulk/list`, mailer-daemon, noreply, our own domain).
  - Rate limit per sender and per agent.
  - 25 KB text cap.
  - Attachments ignored (noted in the reply if present).
  - Bounces ignored.
- **Edge cases:**
  - Unknown recipient → drop (200).
  - Bad signature → 401.
  - Replay → same `Message-ID` → no second reply.
  - Empty body after stripping.
  - Non-English → B5 language.
  - Handoff outside hours → offline ack by email.
  - Sender replies after the conversation was resolved → reopen.
- Every source check (billing SQL `EMBED`, analytics, readiness counts) is reviewed to include `EMAIL` where customer-facing.

## Verification

- **Per phase:**
  - `node --test` units for every pure module (metrics aggregation, answer-state mapping, traits validation, guidance selection, least-busy pick, SLA due time, proactive rules, webhook signing/backoff/idempotency, API-key hashing/scopes, email parsing/threading/loop detection).
  - The `regress.sh` baseline diff (identical except new suites).
  - Lint 0 errors.
- **Migration safety:** apply the migration → run the **clean-`HEAD` live code** test set against the migrated DB → identical results before any code uses it.
- **Live local checks:** metrics cards on real conversations; a traits JWT changes greeting/personalisation; a guidance rule changes the answer; least-busy assigns to a second member; SLA overdue badge; suggest-reply draft; restore a revision; proactive bubble on a matching URL; a webhook to a local test receiver (signature verified, redelivery); an API key lists conversations; an inbound email webhook fixture → AI reply sent via the Resend test sink.
- **Speed:** chat setup and first token must stay unchanged (`meta` time, and the 0.57 ms routing microbench plus guidance/profile).
- **Done at the end:** a summary table per feature (built / tested / live-checked / what remains), and the freeze change log updated for P2 (prompt layers), P7 (outbound calls) and P8 (new inbound channel).
