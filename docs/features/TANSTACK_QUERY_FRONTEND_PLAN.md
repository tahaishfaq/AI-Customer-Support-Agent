# AIDE — TanStack Query (Frontend Cache) Plan

**Status:** Q0 COMPLETE · Q1 BILLING/DESK COMPLETE · agent/dashboard migrations remain
**Created:** 2026-09-05  
**Stack fit:** Next.js App Router · `lib/api/*` + `apiFetch` · Zustand auth · custom poll hooks  
**Pairs with:** [`SOCKET_REALTIME_PLAN.md`](SOCKET_REALTIME_PLAN.md) (invalidate / `setQueryData` on push) · [`REDIS_BULLMQ_ENTERPRISE_PLAN.md`](REDIS_BULLMQ_ENTERPRISE_PLAN.md) (server cache — **different layer**)  
**Active sequence:** [`../OPEN_SEQUENCE.md`](../OPEN_SEQUENCE.md)

---

## 0. Where the frontend stands today

| Pattern | Where | Pain |
| --- | --- | --- |
| **No React Query / SWR** | `package.json` | Har screen apna `useEffect` + `useState` |
| **API layer (good)** | `lib/api/*.js` → `apiFetch` | Keep — yehi `queryFn` / `mutationFn` banega |
| **Auth client state** | Zustand `store/auth-store.js` + NextAuth `SessionProvider` | Theek — **Query se replace mat karo** |
| **Quota “shared cache”** | `hooks/use-conversation-quota.js` — `useSyncExternalStore` + 60s poll + custom event | Hand-rolled RQ; hard to extend |
| **Desk badge poll** | `hooks/use-desk-waiting-count.js` — 30s `setInterval` | Duplicate fetches; no staleTime |
| **Embed desk poll** | `hooks/use-embed-desk.js` | Live UX; later Socket, abhi poll |
| **Agent studio Map** | `hooks/use-agent-studio.js` — module `Map` | No invalidation on edit; tab-switch only |
| **Pages fetch** | e.g. dashboard `listAgents` / analytics in `useEffect` | Remount = refetch storm; no dedupe |
| **Providers** | `components/providers.jsx` — theme + session + tooltip | **No `QueryClientProvider`** |

```text
Today:
  Component → useEffect → lib/api/* → apiFetch → JSON
  (+ ad-hoc Maps / SyncExternalStore / setInterval)

Target:
  Component → useQuery / useMutation → lib/api/* → apiFetch
  QueryClient cache (dedupe, staleTime, invalidate)
  Zustand = auth + pure UI only
  Socket later → queryClient.setQueryData / invalidate
```

**TanStack Query = browser/server-component-adjacent client cache.**  
**Redis = server multi-instance cache.** Do not conflate.

---

## 1. What TanStack Query will improve

| Area | Before | After |
| --- | --- | --- |
| Dashboard / agents list | Remount refetch | Shared `["agents"]` cache |
| Billing quota badge | Custom store + event | `useQuery` + `invalidateQueries` after pay |
| Desk waiting count | Interval only | `refetchInterval` + socket invalidate later |
| Agent studio | Manual Map | `["agent", id]` with placeholderData |
| Mutations (save agent, claim) | Manual reload calls | `onSuccess` → targeted invalidate |
| Loading / error UX | Per-component | Consistent `isPending` / `isError` / `isFetching` |
| Race / double fetch | Common | Automatic request dedupe |

**Out of Query (keep as-is):**

- Auth session / login / logout → Zustand + NextAuth  
- Chat message list while streaming → local state / SSE (optional `setQueryData` after turn)  
- Form draft UI → local / URL state (`use-url-tab`)  
- Embed public widget until authenticated owner app is stable (Phase Q3+)

---

## 2. Target structure (current repo layout)

```text
components/providers.jsx
  └─ QueryClientProvider          ← NEW (wrap inside SessionProvider or outside)
       └─ app shell / pages

lib/api/*                         ← KEEP (queryFns call these)
lib/query/
  client.js                       ← NEW QueryClient factory
  keys.js                         ← NEW query key factory
  hooks/
    use-agents.js                 ← NEW (or migrate hooks/)
    use-billing-status.js
    use-desk-inbox.js
    …

hooks/use-conversation-quota.js   ← THIN wrapper → useQuery (or delete)
hooks/use-desk-waiting-count.js   ← THIN → useQuery
hooks/use-agent-studio.js         ← useQuery(["agent", id])

store/auth-store.js               ← UNCHANGED (client auth)
```

### Query key factory (mandatory)

```js
// lib/query/keys.js
export const queryKeys = {
  me: ["me"] as const, // only if /api/auth/me moves off ad-hoc fetch
  agents: {
    all: ["agents"],
    detail: (id) => ["agents", id],
  },
  billing: {
    status: ["billing", "status"],
    plans: ["billing", "plans"],
  },
  desk: {
    waiting: ["desk", "waiting"],
    inbox: (filters) => ["desk", "inbox", filters],
    stats: (days) => ["desk", "stats", days],
    thread: (conversationId) => ["desk", "thread", conversationId],
  },
  conversations: {
    list: (agentId) => ["conversations", { agentId }],
    detail: (id) => ["conversations", id],
  },
  analytics: {
    overview: (agentId, range) => ["analytics", "overview", agentId, range],
    dashboard: (agentId, range) => ["analytics", "dashboard", agentId, range],
  },
  workspaces: {
    list: ["workspaces"],
  },
  knowledge: {
    list: (agentId) => ["knowledge", agentId],
  },
  actions: {
    list: (agentId) => ["actions", agentId],
  },
};
```

(JS project — use plain arrays; no TS `as const` required.)

### Defaults (enterprise-sensible for Aide)

| Option | Value | Why |
| --- | --- | --- |
| `staleTime` | 30_000 default | Avoid refetch on every tab focus spam |
| `gcTime` | 5–10 min | Memory OK for owner app |
| `retry` | 1 (auth 401 → 0) | Don’t hammer after session death |
| `refetchOnWindowFocus` | true for billing/desk; false for heavy analytics | Tunable per query |
| `queryFn` | only `lib/api/*` | One HTTP policy (`credentials`, 401 → auth store) |

---

## 3. Provider wiring

```jsx
// components/providers.jsx (sketch)
<NextThemesProvider>
  <SessionProvider>
    <QueryProvider>           {/* NEW */}
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </QueryProvider>
  </SessionProvider>
</NextThemesProvider>
```

```js
// lib/query/client.js
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: (count, err) => err?.status !== 401 && count < 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}
```

**SSR note:** App is mostly client fetches today. Use **one browser `QueryClient` per session** (standard Next App Router pattern: `useState(() => makeQueryClient())` in provider). Do not dehydrate unless we later add RSC prefetch.

**401:** Keep `apiFetch` → `markSessionExpired()`. Queries should `throw` so React Query marks error; optional global `QueryCache` `onError`.

---

## 4. Migration map (by surface)

| Surface | Today | Query shape | Invalidate when |
| --- | --- | --- | --- |
| Conversation quota | `use-conversation-quota` | `queryKeys.billing.status` · `refetchInterval: 60_000` | subscribe / cancel / atoms confirm / chat quota event |
| Desk nav badge | `use-desk-waiting-count` | `queryKeys.desk.waiting` · `refetchInterval: 30_000` | claim / resolve / inbox seen · **Socket later** |
| Desk inbox list | `InboxShell` interval | `queryKeys.desk.inbox(filters)` | same |
| Desk thread | `DeskThread` poll | `queryKeys.desk.thread(id)` | human message / typing (socket → `setQueryData`) |
| Agent studio | Map cache | `queryKeys.agents.detail(id)` · `placeholderData` | `updateAgent` mutation |
| Agents list | dashboard / switcher | `queryKeys.agents.all` | create / delete agent |
| Billing plans | plans page | `queryKeys.billing.plans` | rare |
| Analytics | dashboard page | analytics keys · longer `staleTime` (60–120s) | — |
| Workspaces | switcher | `queryKeys.workspaces.list` | create workspace |
| Knowledge list | knowledge UI | `queryKeys.knowledge.list(agentId)` | upload / delete doc |
| Actions / MCP | customization | actions/mcp keys | save action |

### Mutations pattern

```js
const qc = useQueryClient();
const save = useMutation({
  mutationFn: (body) => updateAgent(id, body),
  onSuccess: (data) => {
    qc.setQueryData(queryKeys.agents.detail(id), data);
    qc.invalidateQueries({ queryKey: queryKeys.agents.all });
  },
});
```

Replace `refreshConversationQuota()` custom event with:

```js
qc.invalidateQueries({ queryKey: queryKeys.billing.status });
```

Keep a tiny helper `invalidateBillingStatus(qc)` for call sites that today import `refreshConversationQuota`.

---

## 5. Phased plan

### Phase Q0 — Foundation (½ day)

- [x] `npm i @tanstack/react-query`
- [x] `lib/query/client.js` + `lib/query/keys.js`
- [x] `components/query/QueryProvider.jsx` · wire in `components/providers.jsx`
- [ ] Devtools behind `NODE_ENV === "development"`  
- [ ] Doc: this file + `OPEN_SEQUENCE`  

**Done when:** app boots with empty QueryClient; no behavior change.

---

### Phase Q1 — Replace hand-rolled shared caches (highest ROI)

- [x] Migrate `use-conversation-quota` → `useQuery(billing.status)`
- [x] Replace `refreshConversationQuota()` behavior with `invalidateQueries`
- [x] Migrate `use-desk-waiting-count` → `useQuery` + `refetchInterval`
- [x] Migrate `use-agent-studio` → `useQuery(agents.detail)` · drop module `Map`
- [ ] Smoke: AppShell badge, plans usage, studio tab switch  

**Done when:** custom SyncExternalStore quota store deleted or thin re-export only.

Billing and desk badge are now Query-backed. The existing exported
`refreshConversationQuota()` event remains as a compatibility bridge for
checkout/chat call sites, but it invalidates the shared Query cache instead of
maintaining a second in-memory store.

---

### Phase Q2 — App shell lists & dashboard

- [x] Agents list + workspaces switcher
- [x] Dashboard overview / conversations list
- [x] Billing plans page
- [x] Analytics queries with longer `staleTime`

**Done when:** navigating Agents ↔ Dashboard does not flash full empty state when cache warm.

---

### Phase Q3 — Desk + customization mutations ✅

- [x] Inbox list + thread queries (keep poll intervals as `refetchInterval`)
- [x] Mutations: claim, reply, resolve, mark seen → invalidate desk keys
- [x] Knowledge / actions / MCP list queries + save mutations
- [x] Admin overview queries and primary admin list queries

**Done when:** desk actions update badge without full page reload.

Q3 is implemented with shared query keys, mutation invalidation, optimistic thread
cache updates, and fallback polling for crawl/realtime-sensitive surfaces. The
admin overview, users, and restore-request lists use isolated admin cache keys.

---

### Phase Q4 — Socket alignment (after Socket S1+)

- [x] On desk realtime events → `invalidateQueries(desk.*)` or `setQueryData`
- [x] On billing subscription/quota events → invalidate billing status (stop success poll early)
- [x] Reduce `refetchInterval` when socket connected (poll = fallback only)

Q4 is implemented centrally in `RealtimeQuerySync`. All persisted desk event
types reconcile waiting, inbox, stats, and the affected thread; billing events
reconcile the shared billing status query. Polling remains enabled only while
the socket is disconnected or unavailable.

---

### Phase Q5 — Hardening ✅

- [x] Consistent error boundary / toast on mutation fail
- [x] Prefetch on hover/focus (agent row → detail)
- [x] Embed runtime isolation: QueryProvider is not mounted for `/w/*`
- [x] Query cache remains limited to authorized API responses; credentials/tokens are not query sources

Q5 hardening is implemented. The public embed does not mount the owner
QueryProvider, agent detail navigation prefetches only the authorized agent
endpoint, and mutation failures have a shared toast fallback plus a recoverable
render boundary.

---

## 6. Layering vs Redis / Socket / Zustand

```text
┌──────────────────────────────────────────────────────────┐
│ Browser                                                  │
│  Zustand: auth user, session-expired UI                  │
│  TanStack Query: server state (agents, desk, billing…)   │
│  Local useState: composers, modals, stream buffers       │
└───────────────────────────┬──────────────────────────────┘
                            │ apiFetch
┌───────────────────────────▼──────────────────────────────┐
│ Next.js API + Prisma (+ later Redis OTP/profile/limits)  │
└──────────────────────────────────────────────────────────┘
```

| Layer | Owns |
| --- | --- |
| **Zustand** | Who is logged in / overlay |
| **TanStack Query** | Cached GET responses + mutation lifecycle |
| **Redis** | Multi-instance server OTP, limits, profile |
| **Socket** | Push → update Query cache |
| **BullMQ** | Heavy jobs — UI may poll job status query later |

---

## 7. Explicit non-goals

- Rewriting embed `/w/[publicKey]` in Q0–Q2 (public widget; separate keys later)  
- Replacing NextAuth session with Query  
- Caching raw chat streams in Query as source of truth  
- Putting PEP / confirm authority in the client cache  

---

## 8. Success metrics

| Metric | Target |
| --- | --- |
| Duplicate `/api/billing/status` on shell+dashboard mount | 1 in-flight (RQ dedupe) |
| Studio tab switch agent refetch | cache hit · no full skeleton if warm |
| `refreshConversationQuota` custom event | removed |
| Module-level `agentCache` Map | removed |
| New feature fetch | uses `queryKeys.*` + `lib/api/*` |

---

## 9. File touch map

| Action | Path |
| --- | --- |
| Add | `lib/query/client.js`, `lib/query/keys.js`, `components/query/QueryProvider.jsx` |
| Edit | `components/providers.jsx` |
| Migrate | `hooks/use-conversation-quota.js`, `use-desk-waiting-count.js`, `use-agent-studio.js` |
| Later | `components/desk/*`, `app/(app)/dashboard/page.jsx`, billing components |
| Keep | `lib/api/*`, `lib/api-client.js`, `store/auth-store.js` |

---

## 10. Sequence vs other infra

```text
① Go-live #1–6 (OPEN_SEQUENCE)
② Q0–Q1 TanStack (can run parallel with Redis R0 — no dependency)
③ Redis R1–R3 / BullMQ (server)
④ Q2–Q3 finish app queries
⑤ Socket S0–S3 → Q4 wire push → cache
```

Frontend Query **does not block** Redis OTP; both improve different layers.

---

**Next:** Phase Q0 install + `QueryProvider`, then Q1 migrate quota + desk badge + agent studio.
