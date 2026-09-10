# ADR 002 — AIDE Realtime Architecture and Security Contracts

**Status:** ACCEPTED — one-port Node app server; Phase 0 complete  
**Date:** 2026-09-07  
**Owners:** AIDE platform/runtime  
**Related:** [`SOCKET_REALTIME_PLAN.md`](../features/SOCKET_REALTIME_PLAN.md), [`REDIS_BULLMQ_ENTERPRISE_PLAN.md`](../features/REDIS_BULLMQ_ENTERPRISE_PLAN.md), [`ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md)

## 1. Decision summary

AIDE realtime will use one custom always-on Node.js application server that hosts
both the Next.js HTTP application and Socket.IO on the same public `PORT`. The
server will use a managed, TCP-compatible Redis deployment for Socket.IO
cross-instance fan-out and Redis Streams transport. PostgreSQL remains the only
domain authority and source of truth.

The initial implementation profile is:

```text
Node app server HTTP mutation
  → PostgreSQL transaction: domain state + version + outbox event
  → outbox publisher worker
  → Redis Stream
  → same Node app process fan-out consumer
  → Socket.IO room
  → browser/embed client
```

The exact hosting vendor is intentionally not hard-coded in this ADR. The
deployment gate must select an always-on Node host and a managed TCP Redis
provider that support TLS, ACLs, Pub/Sub, Streams, consumer groups, blocking
reads, persistence/failover, and operational metrics. A serverless REST-only
Redis product is not sufficient for the app/worker connection model. A separate
publisher worker remains allowed, but a separate public Socket.IO service is not
required.

## 2. Frozen invariants

1. Socket handlers never create, update, claim, resolve, bill, or authorize a
   domain record.
2. Existing HTTP routes/services remain the only command path.
3. PostgreSQL is authoritative; Redis and socket payloads are delivery layers.
4. Domain state, aggregate version, and outbox intent commit in one transaction.
5. Clients reconcile with canonical HTTP snapshots after connect, reconnect, or
   a detected cursor/version gap.
6. Owner and public payload serializers are separate code paths.
7. Studio token streaming remains HTTP/SSE and is not moved to Socket.IO.
8. No secret, access token, system prompt, raw tool body, internal note, or
   unnecessary PII is placed in a realtime event.

## 3. Token contracts

### 3.1 Owner realtime token

The Next.js token endpoint issues a short-lived, signed token after a live DB
authorization check. Required claims:

```js
{
  sub: userId,
  sid: realtimeSessionId,
  jti: tokenId,
  typ: "aide-realtime-owner",
  iss: REALTIME_TOKEN_ISSUER,
  aud: REALTIME_TOKEN_AUDIENCE,
  role,
  workspaceIds,
  iat,
  exp
}
```

The gateway must verify signature, issuer, audience, expiry, token type, and
revocation state. It must not trust client-provided workspace or room names.

### 3.2 Public conversation token

The public token endpoint requires a server-issued conversation capability. A
public key and conversation ID alone are not sufficient authorization.

```js
{
  sub: `conversation:${conversationId}`,
  sid: publicRealtimeSessionId,
  jti: tokenId,
  typ: "aide-realtime-public-conversation",
  iss: REALTIME_TOKEN_ISSUER,
  aud: REALTIME_TOKEN_AUDIENCE,
  conversationId,
  agentId,
  publicKeyId,
  customerSubjectHash: null | hash,
  originHash,
  iat,
  exp
}
```

For identified end users, the subject is bound at issuance and cannot be
replaced by a client event. For anonymous users, the short-lived conversation
capability is the authority and must be revocable.

### 3.3 Session lifecycle

- A user may have multiple independent realtime sessions and browser tabs.
- Device logout revokes only that realtime session.
- Sign-out-everywhere revokes all realtime sessions for the user.
- Suspension, disable, or role downgrade invalidates the affected sessions and
  disconnects their gateway connections.
- Token expiry must be enforced on an established connection, not only at the
  next reconnect.

## 4. Room ACL matrix

| Room | Allowed token | Server-side authorization |
| --- | --- | --- |
| `user:{userId}` | owner | token subject matches user; session is live |
| `workspace:{workspaceId}:desk` | owner | user owns/has membership for workspace and current status is allowed |
| `conversation:{conversationId}:owner` | owner | conversation → agent → authorized workspace/user relationship |
| `conversation:{conversationId}:public` | public conversation | capability matches conversation, agent, origin, subject and expiry |
| arbitrary room | none | reject and log |

The current repository has user-owned workspaces rather than a membership table.
The first implementation must preserve that boundary. Future team membership must
extend the authorization service, not be inferred from room names.

## 5. Event envelope

Every durable event uses this envelope:

```js
{
  eventId,
  eventType,
  schemaVersion,
  occurredAt,
  userId: null | string,
  workspaceId: null | string,
  agentId: null | string,
  conversationId: null | string,
  aggregateType,
  aggregateVersion,
  visibility: "OWNER" | "PUBLIC" | "BOTH",
  payload
}
```

Rules:

- `eventId` is globally unique and is the dedupe key.
- `schemaVersion` changes when payload compatibility changes.
- `aggregateVersion` is monotonic within the relevant aggregate/audience.
- Owner-only events must not advance or leak a public conversation sequence.
- Public events use a public-safe payload serializer, not a filtered owner
  payload.
- Event payloads contain IDs, state, timestamps, and allowlisted display fields;
  never credentials or raw internal data.

## 6. Initial event contract

| Event | Visibility | Primary audience | Canonical follow-up |
| --- | --- | --- | --- |
| `conversation.handoff.created` | BOTH | owner desk + public conversation | refetch conversation/inbox |
| `conversation.message.created` | BOTH/OWNER | public-safe message or owner note | refetch conversation |
| `conversation.claim.updated` | OWNER | owner desk/thread | refetch conversation/inbox |
| `conversation.status.updated` | BOTH | owner + public where applicable | refetch conversation/inbox |
| `conversation.priority.updated` | OWNER | owner desk/thread | refetch inbox/thread |
| `conversation.csat.updated` | OWNER | owner thread | refetch conversation |
| `workspace.inbox-seen.updated` | OWNER | workspace desk | refetch badge/count |
| `billing.subscription.updated` | OWNER | user room | refetch billing/access |
| `billing.quota.updated` | OWNER | user room | refetch quota |
| `access.revoked` | OWNER/PUBLIC scoped | affected sessions | disconnect and clear live state |

Typing, presence, connection state, and reconnect status are ephemeral gateway
events and are not durable outbox records.

## 7. Transaction boundaries

The following operations must write domain state, versions, and outbox intent in
one Prisma transaction:

| Mutation | State writes | Events |
| --- | --- | --- |
| Handoff | conversation + acknowledgement message | handoff + message |
| Human reply | human message + claim/typing state | public/owner message + state |
| Internal note | internal message | owner-only message |
| Claim/release | assignment fields | owner claim event |
| Resolve | status, AI pause, timestamps | owner/public status event |
| Priority | priority | owner priority event |
| CSAT | score/timestamp | owner CSAT event |
| Inbox seen | workspace seen timestamp/version | owner inbox-seen event |
| Billing webhook | BillingEvent + subscription state | billing subscription/quota event |

External email, payment-provider calls, and other side effects remain outside
the DB transaction and must not be treated as realtime commit authority.

## 8. Delivery and recovery contract

- PostgreSQL outbox is published at least once.
- Redis Stream consumers are idempotent by `eventId`.
- Publisher retries use bounded exponential backoff and a lease/claim timeout.
- Poison events move to a DLQ with alerting and an explicit replay operation.
- Stream acknowledgement occurs after the gateway has accepted the event for
  room emission; browser receipt is not guaranteed by `XACK`.
- Redis loss must be recoverable by republishing unpublished/replayable events
  from PostgreSQL.
- Per-conversation ordering is required; global ordering is not promised.
- Clients detect gaps using aggregate/audience versions and refetch HTTP state.

## 9. Retention and SLO defaults

These are initial targets and must be confirmed during deployment review:

| Item | Initial contract |
| --- | --- |
| Owner/public token TTL | 5 minutes, refresh before expiry |
| Outbox retry window | 24 hours before DLQ, configurable |
| Redis stream hot retention | 24 hours minimum, capacity-tested |
| DLQ retention | 30 days minimum |
| Persisted event to connected client | p95 under 500 ms |
| Desk badge update | p95 under 1 second |
| Reconnect reconciliation | canonical state under 3 seconds after online |
| Unauthorized room joins | zero |
| Public internal-note leaks | zero |
| Duplicate visible messages | zero |

## 10. Rejected alternatives

- Socket-only domain mutations: rejected because HTTP services currently own
  authorization, billing, confirmation, and business invariants.
- `write DB → emit socket` without an outbox: rejected because a process crash
  can lose the event.
- Redis adapter as the only event bus: rejected because adapter fan-out is not
  a durable application event log.
- Public authorization by public key + conversation ID only: rejected because
  it does not provide a conversation capability.
- One socket per React component: rejected because it multiplies connections,
  token refresh, reconnect, and dedupe behavior.
