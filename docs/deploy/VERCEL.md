# Deploying on Vercel

Vercel runs the Next.js app as serverless functions. It suits the widget, dashboard and chat.
The always-on parts (`server.js` Socket.IO realtime, workers) need a host such as Render
(`docs/deploy/RENDER.md`).

## Must set

| Setting | Value | Why |
|---|---|---|
| Function region | **Singapore (sin1)**: Project → Settings → Functions (redeploy after changing) | Neon is `ap-southeast-1`. From iad1 every database round trip crossed the Pacific: first token went from 0.8–1 s (sin1) to 5–8 s (iad1). Check `x-vercel-id` on `/api/health` ends with `::sin1::…`. |
| `REDIS_ENABLED=1` + `REDIS_URL` | e.g. Upstash (TLS URL) | Without Redis, rate limits and the per-tenant budgets are counted per function instance, not globally (`/api/health` shows `"redis":"disabled"`). |
| `AUTH_URL`, `NEXT_PUBLIC_APP_URL` | The HTTPS production origin | Auth callbacks and embed links. |

Leave `PG_POOL_MAX` / `PG_POOL_IDLE_MS` unset on Vercel (serverless defaults: 3 connections,
10 s idle). The larger always-on values in `render.yaml` are for `server.js`.

## What does not run on Vercel

- **Realtime (Socket.IO):** live desk updates, typing and presence need `server.js`. On Vercel the
  widget and chat work; the desk refreshes without live pushes. Point `REALTIME_URL` at a Render
  service if you need live updates.
- **Workers** (`workers/`, BullMQ crawl queue): run them on an always-on host.

## Before going live

- Tool URLs must be reachable from Vercel. `http://localhost:3000/api/demo/...` works only on a
  laptop; the embed checklist flags these under "HTTP / MCP integrations".
- Open the agent's embed checklist: the "Agent setup" part lists missing knowledge, oversized
  prompts, too many MCP tools and write tools exposed on the widget.
- Expect cold starts: the first message after an idle period is slower (new function + new
  database connection). Warm replies are the numbers above.
