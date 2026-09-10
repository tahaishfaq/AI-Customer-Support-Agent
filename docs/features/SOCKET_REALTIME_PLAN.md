# AIDE — Production Realtime / Socket Architecture Plan

**Status:** PHASE 2 IN PROGRESS — one-port Node app server integration and owner client realtime wiring are implemented; browser product-flow and HA gates remain.  
**Updated:** 2026-09-07  
**Pairs with:** [`REDIS_BULLMQ_ENTERPRISE_PLAN.md`](REDIS_BULLMQ_ENTERPRISE_PLAN.md)  
**Depends on:** [`../ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md)

This plan is for production realtime delivery, not for moving business mutations
into WebSocket handlers.

## 0. Decision

Use one **custom always-on Node.js app server** for both Next.js HTTP/API/Auth
and Socket.IO. Keep Redis as the shared event bus, adapter fan-out layer, and
outbox recovery transport. The app is deployed to a Node host/container, not
Vercel serverless, because the same process owns long-lived WebSocket clients.

```text
Node app server: Next.js HTTP mutation
  → Postgres transaction: state + realtime outbox row
  → outbox publisher worker
  → Redis Streams (durable event bus)
  → same Node app process: Socket.IO rooms
  → desk / embed clients
```

Why this is required:

- One public `PORT` serves both Next.js and Socket.IO; no separate socket-only
  service or `REALTIME_PORT` is required.
- Socket.IO Redis adapter alone is fan-out, not a durable event queue.
- “Write DB, then emit” can lose an event between the two operations.
- Postgres remains the source of truth; realtime is a delivery optimization.

The Socket.IO implementation is kept in an attachable runtime module for
testing and maintainability, but production attaches it to the same HTTP server
created by `server.js`. A separate publisher worker may still run as an
independent process; it is not a second public gateway.

## 1. Existing architecture audit

Current relevant behavior:

| Surface | Current source of truth | Current delivery |
| --- | --- | --- |
| Desk badge | `Workspace.deskInboxSeenAt` + conversations | `use-desk-waiting-count`, 30s poll |
| Desk inbox | `Conversation` and latest message | `InboxShell`, initial load + waiting poll |
| Desk thread | `Conversation` + `Message` | `DeskThread`, waiting poll |
| Embed handoff | Conversation status and messages | `use-embed-desk`, 3–30s poll |
| Human typing | `Conversation.humanTypingAt` TTL | HTTP POST + embed polling |
| Human reply/note | `sendHumanReply` / `sendInternalNote` | HTTP mutation, then client refresh |
| Claim/resolve/priority | `handoff.service.js` mutations | HTTP response + polling |
| Billing/quota | `Subscription` / usage records | status polling and focus refresh |
| Studio token stream | HTTP/SSE | Keep SSE; do not migrate to sockets |

Existing authorization is strong enough to reuse, but the gateway must not
silently trust client room names. The current owner boundary is user + active
workspace + agent/conversation relationship. The public boundary is agent
public key + origin lock + conversation id + verified end-user identity where
applicable.

## 2. Frozen invariants

1. **Postgres is authoritative.** A socket event never creates, updates, claims,
   resolves, confirms, bills, or authorizes a domain record.
2. **HTTP remains the command path.** Existing API routes and services remain the
   only mutation path, including handoff, human reply, claim, resolve, priority,
   confirmation, billing, and chat.
3. **`DATA ≠ AUTHORITY`.** Socket payloads, reconnect metadata, room names, and
   client claims cannot set identity, tenant, permissions, confirmation, or
   allowlists.
4. **Outbox is notify-after-commit.** Domain state and its event intent are
   written atomically in one Postgres transaction.
5. **Every client reconciles.** On first connect, reconnect, missed heartbeat,
   or event gap, fetch the canonical HTTP snapshot.
6. **No secrets in events.** Never publish credentials, system prompts, raw tool
   bodies, access tokens, internal notes, or unnecessary PII.
7. **The architecture freeze remains unchanged.** The orchestrator, PEP,
   confirmation lifecycle, identity, SSRF controls, and tool gateway stay HTTP.

## 3. Runtime topology

```text
Browser / embed widget
       │ same-origin WSS + short-lived signed token
       ▼
Node app server (`server.js`, one `PORT`)
       ├── Next.js HTTP/API/Auth
       ├── Socket.IO rooms + Redis adapter/pubsub
       └── Redis Streams consumer

Outbox publisher worker ── Redis Streams ──┘
Node app server ── Postgres/Neon (authority)
```

Required deployment properties:

- TLS/WSS only in staging and production.
- Gateway health/readiness endpoint and graceful shutdown.
- At least two Node app replicas before claiming HA; one replica is a valid
  initial production deployment only if documented as a single point of failure.
- Redis TLS, ACL/minimal commands, bounded stream retention, and alerts for
  consumer lag/DLQ.
- App replicas are stateless apart from short-lived connection/presence state;
  Redis adapter fan-out is required when replicas exceed one.

## 4. Authentication and room authorization

### Owner console

`POST /api/realtime/token` requires the existing Auth.js session and live user
status. The Next.js server issues a short-lived, audience-bound token containing
only `userId`, allowed workspace ids, role, issuer, audience, issued-at, expiry,
and token id. The gateway verifies the signature and expiry without calling the
client for identity.

Owner rooms:

- `user:{userId}` — private notices such as billing/quota updates.
- `workspace:{workspaceId}:desk` — desk list/count/activity.
- `conversation:{conversationId}:owner` — one owner thread.

The gateway resolves or validates workspace/conversation scope before joining.
The client cannot choose an arbitrary workspace or conversation room.

### Multiple devices, tabs, and sessions

The same user may have many independent Auth.js sessions and realtime
connections at the same time:

```text
Laptop tab 1 ─┐
Laptop tab 2 ─┼─→ user:{userId}
Phone        ─┘
```

Each connection has its own short-lived realtime token, connection id, and
optional device label. User/workspace/conversation events fan out to every
authorized connection, while local UI state (focused thread, draft text,
scroll position) remains device-local. A message received through HTTP and then
through the socket is deduplicated by event id/message id.

Claims, resolve, reply, priority, and billing authority remain server-side and
are resolved by the existing HTTP services. If two devices mutate the same
thread, both receive the committed result; the database response wins over any
optimistic local state.

Logout and revocation rules:

- Closing one tab/device only disconnects that connection; other devices stay
  connected.
- A token is not stored in localStorage and expires quickly (target 5 minutes).
- Reconnect always requests a fresh token and re-checks Auth.js user status,
  workspace access, and room scope.
- Account suspension, user disable, agent disable, or “sign out everywhere”
  publishes a private access-revoked event and disconnects that user's gateway
  connections; token expiry remains the safety fallback.
- Device-level logout revokes that device's realtime token/session without
  affecting the user's other devices.

### Public embed

`POST /api/public/agents/[publicKey]/conversations/[conversationId]/realtime-token`
validates the same agent, conversation, embed-enabled state, request origin,
and public conversation scope as the existing conversation API. If an end-user
identity exists, the token is bound to the server-resolved subject hash; the
client cannot supply a different subject after issuance.

Embed room:

- `conversation:{conversationId}:public`

The token is short-lived and conversation-scoped. No public client may join an
agent-wide owner or desk room.

### Socket event authorization

- Server decides which rooms a token may join.
- Client-to-server events are allowlisted and schema-validated.
- Typing is the only planned client-to-server realtime event; it is rate-limited
  and checked against the token scope plus current conversation state.
- Any unauthorized join/event is rejected and logged with request/connection id.

## 5. Event contract

Every event uses a versioned envelope:

```js
{
  eventId: "uuid",
  eventType: "conversation.message.created",
  schemaVersion: 1,
  occurredAt: "ISO-8601",
  workspaceId: "...",
  agentId: "...",
  conversationId: "...",
  aggregateVersion: 12,
  visibility: "OWNER" | "PUBLIC" | "BOTH",
  payload: { /* allowlisted public fields only */ }
}
```

Initial durable events:

- `conversation.handoff.created`
- `conversation.message.created` — public version excludes `INTERNAL`
- `conversation.claim.updated`
- `conversation.status.updated`
- `conversation.priority.updated`
- `conversation.csat.updated` — only where UI needs it
- `billing.subscription.updated`
- `billing.quota.updated`

Ephemeral gateway events (not outbox records):

- `conversation.typing.started` / `conversation.typing.stopped`
- `presence.updated`
- `connection.state`

One domain mutation can produce one event only after its DB transaction commits.
Events are idempotent by `eventId`; clients deduplicate by `eventId` and message
id. `aggregateVersion` lets clients detect a gap and refetch.

## 6. Data and delivery model

Add a Postgres `RealtimeOutboxEvent` model/table. Minimum fields:

- unique `eventId`
- `eventType`, `schemaVersion`, `visibility`
- `workspaceId`, `agentId`, `conversationId`, optional `userId`
- JSON payload containing only the allowlisted event data
- `aggregateVersion`
- `createdAt`, `publishedAt`, `attempts`, `lastError`, `availableAt`

The publisher claims unpublished rows safely, writes them to a Redis Stream, and
marks them published. Failed rows retry with backoff; poison rows go to a DLQ
and alert. Publishing is at-least-once, so consumers and clients must be
idempotent. Do not promise exactly-once delivery.

The gateway consumes the stream, validates the envelope, maps it to authorized
rooms, and emits it. If the gateway is unavailable, events remain replayable;
the HTTP fallback still makes the UI correct.

## 7. Client behavior and fallback

Create one browser-side connection manager/provider, not one socket per
component. It owns connection lifecycle, token refresh, backoff, online/offline
state, event dedupe, and metrics.

Client rules:

- Fetch the initial HTTP snapshot before showing realtime as healthy.
- Connect with exponential backoff + jitter and a maximum reconnect rate.
- Refresh token before expiry; never put long-lived secrets in localStorage.
- On reconnect, refetch the relevant snapshot before applying live events.
- On an `aggregateVersion` gap, refetch the conversation/inbox query.
- Keep existing polling as a degraded fallback. Stop/slow it only after the
  socket is connected and the first reconciliation succeeds.
- HTTP mutation responses update the local UI immediately; subsequent socket
  events are deduped, not appended twice.
- Show a small “reconnecting / live updates paused” state when appropriate.

Surface mapping:

| Surface | Socket subscription | Fallback |
| --- | --- | --- |
| App badge | `workspace:{id}:desk` | `use-desk-waiting-count` poll |
| Inbox list | desk room | `InboxShell` waiting poll |
| Desk thread | owner conversation room | `DeskThread` poll |
| Embed thread | public conversation room | `useEmbedDesk` poll |
| Billing/quota | user room | existing status/focus polling |
| Studio tokens | none | existing HTTP/SSE |

Internal notes are owner-only and must never reach the public room.

## 8. Implementation phases

### Phase 0 — Architecture and contracts

**Status:** COMPLETE — one-port Node topology, contracts, Redis boundary, token/room ACL, and transaction rules are frozen in [`002-realtime-architecture.md`](../decisions/002-realtime-architecture.md) and [`REALTIME_ENVIRONMENT_CONTRACT.md`](REALTIME_ENVIRONMENT_CONTRACT.md).

- Decide the always-on Node host and Redis provider.
- Add an ADR and environment contract (`PORT`, optional same-origin
  `REALTIME_URL`, token secret/audience, Redis URL/ACL, stream names, feature
  flags).
- Define the event envelope, room ACL matrix, token claims, payload allowlists,
  retention, retry/DLQ policy, and SLOs.
- Decide the outbox transaction boundary for each handoff mutation.

**Exit:** security review accepts the design; no socket code in orchestrator or
PEP; local `server.js` can serve Next.js and Socket.IO on one port, verify a
token, and reject an invalid room.

**Mandatory test gate after Phase 0:**

- Contract tests validate the event envelope, token claims, room ACL matrix, visibility rules, and schema versions.
- Security tests reject expired, malformed, wrong-audience, wrong-workspace, wrong-conversation, and origin-mismatched tokens.
- A multi-device contract test proves that two realtime sessions for one user are independently identifiable and that device logout does not revoke the other session.
- A design-review checklist confirms that HTTP remains the only mutation path and that no socket payload is treated as authority.
- Do not begin Phase 1 until all Phase 0 tests and the security review pass.

### Phase 1 — Infrastructure skeleton

**Status:** IMPLEMENTED FOUNDATION — migration, shared contracts, owner/public token paths, outbox publisher, attachable Socket.IO runtime, one-port Node server, and integration fan-out are green; multi-replica HA/load hardening remains Phase 6.

- Add `lib/realtime/` shared constants, schemas, token helpers, event builder,
  and safe logger.
- Add the outbox migration/model and indexes.
- Add publisher/worker and Redis Stream consumer.
- Build the attachable Socket.IO runtime, one-port `server.js` host, health,
  graceful shutdown, connection limits, CORS/origin checks, heartbeat, and
  structured metrics.
- Add feature flags: `REALTIME_ENABLED`, `REALTIME_DESK_ENABLED`,
  `REALTIME_EMBED_ENABLED`.

**Exit:** the same Node process serves `/healthz`, Next.js, and an authorized
Socket.IO room; a synthetic outbox event survives a publisher restart and never
reaches an unauthorized room.

**Mandatory test gate after Phase 1:**

- Unit tests cover token verification, room authorization, event schema validation, payload size limits, and visibility filtering.
- Integration tests cover outbox insert, publisher retry, duplicate publish, Redis reconnect, consumer restart, pending-message reclaim, DLQ routing, and two-node fan-out.
- Failure tests kill the publisher before and after stream publish and verify idempotent recovery through `eventId`.
- Operational tests verify readiness, liveness, graceful shutdown, connection limits, metrics, and feature-flag-off behavior.
- Do not begin Phase 2 until a synthetic event survives publisher and consumer restarts without unauthorized delivery.

### Phase 2 — Desk realtime

**Status:** IN PROGRESS — shared owner Socket.IO provider, workspace-room
subscription, billing/quota invalidation, desk refresh, and polling fallback
are implemented. Server-side security, multi-device coverage, duplicate-event
deduplication, stale-response protection, and disconnected polling fallback are
green; full browser/product-flow gate remains.

- Emit outbox events from handoff creation, human reply, internal state changes,
  claim, resolve, and priority mutations.
- Add owner token route and desk/conversation room joins.
- Add one shared client connection manager.
- Migrate badge, inbox list, and desk thread to event-driven refresh with poll
  fallback.
- Add billing/quota subscription to the same authenticated user-room connection.
- Treat Redis as the realtime delivery bus, not as an authorization source or
  blind API-response cache. PostgreSQL remains authoritative.
- Load the initial HTTP snapshot first, then let socket events trigger targeted
  invalidation/reconciliation. Stop or slow normal desk and billing polling
  only after the socket is connected and the first reconciliation completes;
  restore polling when disconnected.
- Keep the bounded billing-success confirmation loop as a fallback because the
  payment webhook and database remain authoritative. A socket event may finish
  that loop early, but cannot replace webhook reconciliation.
- Add a Redis materialized count/cache only if measured scale requires it; the
  first optimization is socket-driven invalidation for correctness.

**Exit:** two owner tabs converge after every mutation; duplicate events do not
duplicate messages; cross-workspace access is rejected; restarting the one-port
Node server recovers through polling and reconnect reconciliation.

**Mandatory test gate after Phase 2:**

- Product-flow tests cover handoff, claim, human reply, internal note, resolve, priority, CSAT, inbox seen, and badge updates.
- Transaction tests prove that domain state and its outbox event commit together or roll back together.
- Browser tests cover two tabs, two devices, different active workspaces, reconnect, stale snapshots, duplicate events, and polling fallback.
- Security tests prove cross-user, cross-workspace, cross-agent, and unauthorized conversation-room joins are rejected.
- The Phase 2 security test verifies two sessions for one user can coexist, an
  unauthorized conversation room is rejected, and revoking one session leaves
  the other device connected.
- The Phase 2 client/product tests verify duplicate event IDs are emitted once
  to the UI, stale HTTP snapshots cannot overwrite newer snapshots, polling
  resumes for every desk view while disconnected, and all desk/billing
  mutations enqueue an outbox event in the same transaction.
- Browser coverage is available through `npm run test:realtime-phase2-browser`.
  It runs one-port health/readiness, logged-out auth, and authenticated two-tab
  Redis fan-out checks. The authenticated test creates and revokes a disposable
  active realtime session automatically; `REALTIME_E2E_TOKEN` and
  `REALTIME_E2E_USER_ID` may be supplied when a fixed test session is required.
- Internal notes must be visible to owner clients only and must never reach any public test room.
- Client contract tests prove that socket events invalidate only matching
  desk/billing surfaces, reconnect performs HTTP reconciliation, and no Redis
  value is treated as authorization.
- Do not begin Phase 3 until desk flows pass with realtime enabled and disabled.

### Phase 3 — Public embed handoff

**Status:** IN PROGRESS — public capability token, public conversation room,
reconnect/token refresh, safe event filtering, and polling fallback are
implemented. Public browser connection, notification trigger, and revocation
integration gates are green; full public chat mutation/reconnect UX coverage
is covered by the public contract/integration/load suites; provider-backed
browser mutation tests remain a later UX expansion.

- Add conversation-scoped public realtime token route.
- Emit public-safe handoff and human-message events.
- Migrate embed waiting/reply state and notifications to the public room.
- Keep HTTP handoff, chat, CSAT, and conversation APIs unchanged.

Phase 3 verification commands:

- `npm run test:realtime-public-access` — origin binding and expired capability.
- `npm run test:realtime-phase3-integration` — public room ACL, fan-out, and
  revocation disconnect.
- `npm run test:realtime-phase3-load` — concurrent public capability/socket
  connections and event delivery.
- `npm run test:realtime-phase2-browser -- --grep "public embed"` — actual
  public widget capability connection in Chromium.

**Exit:** human reply appears in the correct widget only, internal notes never
leak, origin lock and subject binding remain intact, and refresh/reconnect
returns the canonical message list.

**Mandatory test gate after Phase 3:**

- Public capability tests cover issuance, expiry, replay, revocation, wrong conversation, wrong agent, wrong origin, and subject mismatch.
- Embed tests cover anonymous conversations, identified conversations, identity expiry, handoff, human reply, refresh, reconnect, and multiple widgets.
- Security tests prove that a leaked public key plus conversation ID cannot bypass the conversation capability requirement.
- Payload tests prove that internal notes, owner-only metadata, billing data, and credentials never enter public events.
- Browser tests confirm that only the intended widget receives the event and that HTTP snapshot reconciliation restores the canonical message list.
- Do not begin Phase 4 until public access and leakage tests pass.

### Phase 4 — Ephemeral typing and presence

Status: **PHASE 4 COMPLETE — ephemeral typing and presence shipped**

Phase 4.0 freezes the validated event types, payload schemas, and room-targeting
rules in `lib/realtime/ephemeral.js`. These events remain ephemeral: they do not
enter the durable outbox or Redis Stream. Gateway handlers, debounce/TTL, rate
limits, and disconnect cleanup now use these contracts. Live integration verifies
owner/public fan-out, room ACLs, TTL expiry, disconnect cleanup, and no typing DB
writes. Browser reconnect regression, two-gateway Redis adapter fan-out, and
controlled load/rate-limit tests are also green.

- Add validated typing start/stop events with debounce, TTL, and per-connection
  rate limits.
- Keep the existing persisted `humanTypingAt` HTTP path for fallback and
  reconciliation; socket typing must not become business state.
- Add owner desk presence and optional “viewing this conversation” indicators.

**Exit:** typing cannot be spoofed across rooms, does not create DB write load,
and disappears on disconnect/TTL expiry.

**Mandatory test gate after Phase 4:**

- Unit tests cover typing debounce, TTL expiry, stop events, malformed payloads, and per-connection rate limits.
- Integration tests verify that typing events do not write persistent business state and that the existing HTTP fallback remains correct.
- Security tests reject typing into another conversation, workspace, or public/owner room.
- Failure tests verify cleanup after browser close, gateway disconnect, reconnect, and heartbeat timeout.
- Load tests verify typing traffic does not create uncontrolled Postgres writes or gateway memory growth.

**Verification:**

- `npm run test:realtime-phase4`
- `npm run test:realtime-phase4-integration`
- `npm run test:realtime-phase4-cross-node`
- `npm run test:realtime-phase4-load`
- `PLAYWRIGHT_PORT=4332 npm run test:realtime-phase2-browser -- --reporter=line`
- Do not begin Phase 5 until ephemeral-state and rate-limit tests pass.

### Phase 5 — Billing/quota and operational notifications

Status: **PHASE 5 COMPLETE — billing/quota realtime shipped**

Phase 5.0 freezes strict owner-only payload schemas for subscription updates,
quota snapshots, and inbox-seen updates in `lib/realtime/business-events.js`.
Provider credentials, checkout references, payment instruments, and private
account data are not valid socket payload fields. The payment webhook and
canonical database snapshot remain authoritative. The quota producer now emits
an owner-only snapshot atomically with the second billable EMBED user message;
it does not emit for Studio chats or non-billable first messages. The gateway
now validates these business payloads before fan-out, while billing/quota and
inbox clients ignore stale aggregate versions and retain polling only as the
disconnected fallback.

- Publish subscription/quota events from authoritative billing/usage commits.
- Stop existing billing polling only after event + snapshot reconciliation works.
- Add user-room notifications with strict payload allowlists.

**Exit:** payment webhook remains the authority; a socket can only accelerate
the UI update and never grants product access.

**Mandatory test gate after Phase 5:**

- Billing integration tests cover duplicate webhook, failed webhook, retry, activation, cancellation, expiry, and quota changes.
- Transaction tests prove that billing state and billing outbox events commit atomically.
- Authorization tests prove that socket events never grant, extend, or remove product access without the canonical HTTP/database check.
- Multi-device tests verify billing and quota updates reach all authorized user sessions without leaking data across users.
- Fallback tests verify that billing focus refresh and polling restore correct state when Redis or the gateway is unavailable.
- Do not begin Phase 6 until webhook authority and quota reconciliation tests pass.

**Verification:**

- `npm run test:realtime-phase5`
- `npm run test:realtime-phase5-integration`
- `npm run test:realtime-integration`
- `npm run test:billing`
- `npm run build`

### Phase 6 — Production hardening and rollout

**Status:** PHASE 6.0 IMPLEMENTED — runtime hardening and executable validation
are in place. Capacity ceilings, per-identity limits, connection-attempt rate
limiting, metrics, Redis consumer retry/recovery, publisher retry/recovery, and
the `/metrics` endpoint are implemented. The gateway also emits safe
connect/disconnect/rejection lifecycle logs and exposes disconnect totals and
last safe rejection/disconnect reasons. Final production exit still requires
live two-replica chaos/load evidence, alert wiring, rollback rehearsal, and
runbook review.

- Load test connections, reconnect storms, stream lag, room fan-out, and event
  recovery with two Node app replicas.
- Test Redis outage, Node app restart, publisher crash, duplicate delivery,
  stale token, revoked user, origin mismatch, and cross-tenant joins.
- Add dashboards/alerts for connection count, auth rejects, reconnect rate,
  publish latency, consumer lag, DLQ, fallback poll rate, and event gap rate.
- Canary desk first, then embed, then billing notifications. Keep kill switches
  and polling fallback during the rollout.

**Implemented Phase 6 verification commands:**

- `npm run test:realtime-phase6`
- `npm run test:realtime-phase6-integration`
- `npm run test:realtime-phase6-load`
- `npm run test:realtime-full`
- `npm run test:realtime-full-browser`

**Exit:** SLOs are met, recovery tests pass, runbook exists, and rollout can be
reversed by flags without a database rollback.

**Mandatory test gate after Phase 6:**

- Load tests cover connection ramp, reconnect storms, two Node app replicas, room fan-out, stream lag, and the agreed production connection target.
- Chaos tests cover Redis outage, Node app crash, publisher crash, consumer reclaim, duplicate delivery, stale token, revoked user, origin mismatch, and cross-tenant joins.
- Security regression suite passes for all owner, public, multi-device, and revocation scenarios.
- Browser end-to-end tests capture final pass/fail output for desk, embed, billing, reconnect, and polling fallback.
- Observability tests verify alerts for auth rejects, reconnect rate, publish latency, consumer lag, DLQ, event gaps, and fallback poll rate.
- Rollback rehearsal proves that feature flags disable realtime without database rollback and that the HTTP product remains correct.
- Production rollout is blocked until all critical tests pass and the runbook is reviewed.

## 9. Security and abuse requirements

- Token TTL target: 5 minutes; rotate without disconnecting healthy clients.
- Maximum connections per user, per public conversation, per IP, and per agent.
- Maximum rooms per connection and maximum payload/event sizes.
- Origin allowlist for owner and embed; never use `*` for the gateway in prod.
- Validate every token, room, client event, and server payload with schemas.
- Redact tokens, cookies, message bodies, and PII from logs.
- Do not expose Redis directly to browsers.
- Rate-limit connection attempts, joins, typing, and malformed events.
- Revoke access on suspension/disable where practical; short TTL limits residual
  access and reconnect performs fresh authorization.

## 10. SLOs and correctness targets

| Metric | Initial target |
| --- | --- |
| Persisted event to connected client | p95 < 500ms |
| Inbox badge update | p95 < 1s |
| Reconnect recovery | canonical state < 3s after online |
| Unauthorized room joins | 0 |
| Public internal-note leaks | 0 |
| Duplicate visible messages | 0 |
| Desk poll reduction after stable connection | ≥ 70% |
| Outbox stuck/DLQ events | alert immediately |

## 11. File and schema map

Likely additions:

| Area | Path |
| --- | --- |
| Shared realtime constants/schemas | `lib/realtime/` |
| Token route | `app/api/realtime/token/route.js` |
| Public token route | `app/api/public/agents/[publicKey]/conversations/[conversationId]/realtime-token/route.js` |
| Outbox model | `prisma/schema.prisma` + migration |
| Publisher/worker | `workers/` or `lib/queue/` |
| Combined Node server | `server.js` |
| Socket runtime | `realtime-gateway/attach.js` |
| Client manager | `components/realtime/` or `hooks/use-realtime.js` |
| Desk migration | `hooks/use-desk-waiting-count.js`, `components/desk/InboxShell.jsx`, `components/desk/DeskThread.jsx` |
| Embed migration | `hooks/use-embed-desk.js`, `components/embed/PublicWebchat.jsx` |
| Domain emits | `lib/services/handoff.service.js`, billing/usage services |

The exact outbox code must be introduced through service-level transactions;
do not add scattered `emit()` calls directly inside route handlers.

## 12. Testing gates

- Unit: token claims, room ACL, event schemas, visibility filtering, dedupe,
  backoff, aggregate-version gap detection.
- Integration: DB transaction + outbox, retry, duplicate publish, DLQ, Redis
  reconnect, one-port Node restart, two-replica fan-out.
- Security: cross-user/workspace/agent/conversation joins, public origin lock,
  subject mismatch, suspended user, expired/revoked token, internal note leak.
- Product: handoff → claim → reply → resolve; simultaneous tabs; embed reply;
  billing webhook → UI update; socket-off fallback.
- Load: connection ramp, reconnect storm, 100+ concurrent desk/embed clients,
  event fan-out, and Postgres/outbox lag.
- Browser: Playwright tests must capture final pass/fail output; an interrupted
  run is not evidence of completion.

## 13. Explicit non-goals

- No orchestrator, PEP, confirmation, identity, tool, or billing authority over
  sockets.
- No migration of studio token streaming away from HTTP/SSE.
- No “exactly once” delivery claim.
- No socket-only UI without HTTP snapshot/reconciliation.
- No WhatsApp, Slack, or other channel adapter in this track.

## 14. Sequence with existing roadmap

Before implementation, finish the Phase 0 design decision and Redis foundation
needed for the outbox/bus. Desk realtime should be the first user-visible slice.
The recommended order is:

```text
Redis foundation + one-port Node ADR
  → outbox + attachable Socket.IO runtime
  → desk badge/list/thread
  → embed handoff/replies
  → typing/presence
  → billing/quota notifications
  → load/security/chaos tests + canary rollout
```

This supersedes the earlier socket plan's “Redis adapter only” shape. The
architecture freeze and `OPEN_SEQUENCE.md` must reference this plan as the
production implementation track.
