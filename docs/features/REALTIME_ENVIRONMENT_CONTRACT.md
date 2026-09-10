# AIDE Realtime Environment Contract

**Status:** ACCEPTED — one-port Node app; values not committed  
**Related:** [`002-realtime-architecture.md`](../decisions/002-realtime-architecture.md)

This document defines names and ownership for realtime configuration. It must
contain variable names only; secret values belong in the deployment secret
manager and must never be committed.

## Next.js application

| Variable | Required | Purpose |
| --- | --- | --- |
| `REALTIME_ENABLED` | yes | global kill switch |
| `REALTIME_DESK_ENABLED` | yes | desk rollout flag |
| `REALTIME_EMBED_ENABLED` | yes | public embed rollout flag |
| `REALTIME_BILLING_ENABLED` | yes | billing notification rollout flag |
| `REALTIME_URL` | optional | same-origin override; defaults to `NEXT_PUBLIC_APP_URL`/`AUTH_URL` |
| `REALTIME_TOKEN_SECRET` | production | signing/verification secret or key reference |
| `REALTIME_TOKEN_ISSUER` | yes | token issuer claim |
| `REALTIME_TOKEN_AUDIENCE` | yes | token audience claim |
| `REALTIME_TOKEN_TTL_SECONDS` | yes | short-lived token TTL; default target 300 |
| `REALTIME_OWNER_ORIGINS` | production | owner gateway origin allowlist |
| `REALTIME_EMBED_ORIGINS` | production | public gateway origin policy |

## Publisher and worker

| Variable | Required | Purpose |
| --- | --- | --- |
| `REALTIME_REDIS_URL` | production | TLS TCP Redis connection URL |
| `REALTIME_REDIS_USERNAME` | production | least-privilege Redis ACL user |
| `REALTIME_REDIS_PASSWORD` | production | Redis ACL secret |
| `REALTIME_STREAM_NAME` | yes | durable realtime stream name |
| `REALTIME_DLQ_STREAM_NAME` | yes | poison-event stream name |
| `REALTIME_CONSUMER_GROUP` | yes | fan-out consumer group name |
| `REALTIME_PUBLISH_BATCH_SIZE` | yes | bounded outbox publish batch |
| `REALTIME_PUBLISH_LEASE_SECONDS` | yes | publisher claim lease |
| `REALTIME_RETRY_MAX_SECONDS` | yes | retry backoff ceiling |
| `REALTIME_DLQ_AFTER_SECONDS` | yes | maximum retry window |
| `REALTIME_STREAM_RETENTION_SECONDS` | yes | hot stream retention |

## Gateway

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | yes | one public Node listen port for Next.js and Socket.IO |
| `REALTIME_ALLOWED_ORIGINS` | production | exact browser/embed origin allowlist |
| `REALTIME_MAX_CONNECTIONS` | yes | process connection ceiling |
| `REALTIME_MAX_CONNECTIONS_PER_USER` | yes | owner session ceiling |
| `REALTIME_MAX_CONNECTIONS_PER_PUBLIC_CONVERSATION` | yes | embed abuse ceiling |
| `REALTIME_MAX_ROOMS_PER_CONNECTION` | yes | room abuse ceiling |
| `REALTIME_MAX_EVENT_BYTES` | yes | inbound/outbound event size ceiling |
| `REALTIME_CONNECTION_RATE_LIMIT_PER_MINUTE` | yes | per-IP connection-attempt ceiling |
| `REALTIME_HEARTBEAT_INTERVAL_SECONDS` | yes | gateway heartbeat interval |
| `REALTIME_GRACEFUL_SHUTDOWN_SECONDS` | yes | drain window |
| `REALTIME_LOG_LEVEL` | yes | structured log level |

## Deployment requirements

The selected deployment must prove:

- WSS termination and forwarding to the one-port Node app.
- Sticky-session behavior if Engine.IO long polling is enabled.
- WebSocket-only behavior if long polling is disabled.
- TLS and ACL support for Redis.
- Redis Pub/Sub, Streams, consumer groups, blocking reads, and failover.
- App readiness, liveness, rolling restart, and graceful drain.
- Secret rotation without committing secrets or disconnecting all healthy users.
- Metrics for connection count, auth rejects, reconnects, publish latency,
  consumer lag, DLQ size, event gaps, and fallback polling.

## Forbidden values and practices

- No Redis credentials in source, logs, browser payloads, or event payloads.
- No wildcard production CORS/origin policy.
- No `REALTIME_TOKEN_SECRET` in client-side environment variables.
- No REST-only Redis client for the blocking stream consumer or Socket.IO adapter.
- No production claim until the provider and capacity review are signed off.
