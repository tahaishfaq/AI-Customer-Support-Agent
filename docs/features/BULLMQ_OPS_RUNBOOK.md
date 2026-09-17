# BullMQ ops runbook

**Audience:** on-call / owner  
**Scope:** `email`, `billing`, `crawl`, `knowledge` queues  
**Authority:** queues carry async side effects only — never PEP, confirm, or identity.

Admin UI `/admin/queues` shows **counts only**. Pause / drain / retry are CLI ops below.

## Preconditions

- `BULLMQ_ENABLED=1`
- Redis URL set (`REDIS_URL` or `REALTIME_REDIS_URL`)
- Worker: `npm run worker:jobs`
- Counts: `/admin/queues` or `GET /api/admin/queues` (admin session)

## Pause / resume

```bash
# Pause email queue
QUEUE=email node --input-type=module -e '
import "dotenv/config";
import { getQueue } from "./lib/jobs/queues.js";
const q = getQueue(process.env.QUEUE);
if (!q) throw new Error("queue unavailable");
await q.pause();
console.log("paused", process.env.QUEUE);
await q.close();
'

# Resume
QUEUE=email node --input-type=module -e '
import "dotenv/config";
import { getQueue } from "./lib/jobs/queues.js";
const q = getQueue(process.env.QUEUE);
if (!q) throw new Error("queue unavailable");
await q.resume();
console.log("resumed", process.env.QUEUE);
await q.close();
'
```

## Drain (waiting jobs)

Removes **waiting** (and optionally delayed) jobs. Does not kill active work. Prefer after pause.

```bash
QUEUE=email DRAIN_DELAYED=1 node --input-type=module -e '
import "dotenv/config";
import { getQueue } from "./lib/jobs/queues.js";
const q = getQueue(process.env.QUEUE);
if (!q) throw new Error("queue unavailable");
await q.drain(process.env.DRAIN_DELAYED === "1");
console.log("drained", process.env.QUEUE);
await q.close();
'
```

Do **not** obliterate completed/failed history unless investigating Redis pressure.

## Retry failed (batched)

```bash
QUEUE=email LIMIT=20 node --input-type=module -e '
import "dotenv/config";
import { getQueue } from "./lib/jobs/queues.js";
const q = getQueue(process.env.QUEUE);
if (!q) throw new Error("queue unavailable");
const failed = await q.getJobs(["failed"], 0, Number(process.env.LIMIT || 20) - 1);
for (const job of failed) {
  console.log(job.id, job.failedReason);
  await job.retry();
}
console.log("retried", failed.length);
await q.close();
'
```

Inspect `failedReason` before retrying poison payloads.

## Worker restart

1. Pause queues if a bad deploy is suspected.  
2. Stop `worker:jobs`.  
3. Deploy / fix.  
4. Start `npm run worker:jobs`.  
5. Resume queues.  
6. Confirm `/admin/queues` failed count is stable.

## Kill switches

| Flag | Effect |
| --- | --- |
| `BULLMQ_ENABLED=0` | App uses inline / sync paths; no enqueue |
| Stop worker process | Jobs accumulate in Redis until worker returns |
| `REDIS_ENABLED=0` | Cache/OTP/limits fall back to in-memory Maps |

HTTP product must keep working with queues off (freeze: authority stays in Postgres + PEP).

## Alerts (minimum)

- `failed` count rising over 15m  
- `waiting` depth stuck high with worker up  
- Worker process down  
- Redis unreachable while `BULLMQ_ENABLED=1`

## Related

- Plan: [`REDIS_BULLMQ_ENTERPRISE_PLAN.md`](REDIS_BULLMQ_ENTERPRISE_PLAN.md)  
- Env: [`REALTIME_ENVIRONMENT_CONTRACT.md`](REALTIME_ENVIRONMENT_CONTRACT.md)  
- Admin counts API: `app/api/admin/queues/route.js`
