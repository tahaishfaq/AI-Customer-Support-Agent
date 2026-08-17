# Hapy data-processing pipeline

**What this is:** a **basic in-app workflow**, not a separate Spark/Airflow job.  
**When it runs:** (1) **online**, on every chat turn, and (2) **on demand**, when a dashboard loads.  
**App code:** `AI-Customer-Support-Agent/`

```
Raw conversation data
        ↓
Data cleaning
        ↓
Data transformation
        ↓
Feature extraction
        ↓
Analysis
        ↓
Database
        ↓
Dashboard
```

---

## End-to-end map

| Internship step | What Hapy does | Where |
| --- | --- | --- |
| **Raw conversation data** | Visitor / owner types a message (studio, in-app chat, or public embed). | `sendChatMessage` in `lib/services/chat.service.js` |
| **Data cleaning** | Trim empty text; cap classify input to 2 000 chars; parse JSON labels; if the classifier fails, use safe defaults (`GENERAL` + `NEUTRAL`). Secrets in **website crawl** knowledge are redacted before save. | `lib/services/ai/classify.js`, `lib/services/site-redact.js` |
| **Data transformation** | Group turns into a `Conversation`; store `USER` vs `ASSISTANT`; measure reply latency as `responseTime` (ms); keep last *n* turns as model history. | `chat.service.js` + Prisma `Conversation` / `Message` |
| **Feature extraction** | Second small LLM call labels **topic** (`category`) and **sentiment**. Latency is a numeric feature on the assistant message. | `classifyCategoryAndSentiment` |
| **Analysis** | Count, %, time buckets, heatmap, workload, written insights. **No fake sample data** — empty range = empty charts. | `lib/services/analytics.service.js` |
| **Database** | Neon PostgreSQL via Prisma. Labels live on `Conversation`; timing on `Message`. | `prisma/schema.prisma` |
| **Dashboard** | Workspace `/analytics` and per-agent `/agents/[id]/analytics`. | `GET /api/analytics/dashboard` |

---

## Stage 1 — Raw conversation data

Sources of chat turns:

- Owner **Test** studio or in-app chat (`POST /api/agents/[id]/chat`)
- Site visitor **embed** (`POST /api/public/agents/[publicKey]/chat`)

Each turn is the visitor’s string plus (after the model replies) the assistant string. A conversation id continues the thread.

---

## Stage 2 — Data cleaning

| Clean | Why |
| --- | --- |
| Reject empty / whitespace-only messages (API validation) | Garbage in would pollute counts |
| `trim()` + slice classifier text to **2000** characters | Keep the classify call cheap and bounded |
| JSON parse of `{ category, sentiment }`; unknown values discarded | Model output is not trusted as-is |
| Fallback **GENERAL / NEUTRAL** if classify fails | Chat still succeeds; analytics stay valid enums |
| Crawl **redaction** of secrets/keys in WEB knowledge | Public HTML must not leak internals into the agent |

This is *lightweight* cleaning (support-desk scale), not a NLP tokenize/stopword lab notebook.

---

## Stage 3 — Data transformation

1. Create or reuse a `Conversation` row (`agentId`, `startedAt`).
2. Insert a `Message` with `role = USER` and raw `content`.
3. Load knowledge + recent messages (oldest → newest) for the LLM.
4. Insert a `Message` with `role = ASSISTANT`, `content`, and `responseTime` (model latency in ms).

Transformed record (conceptually):

```text
conversation: { id, agentId, startedAt, category, sentiment }
message:      { role, content, responseTime?, createdAt }
```

---

## Stage 4 — Feature extraction

After the assistant reply is saved, Hapy runs **one extra classification call** (`classifyCompletion`) on:

```text
User: <last user message>
Assistant: <last assistant message>
```

Extracted features stored on the **conversation** (updated every turn):

| Feature | Values |
| --- | --- |
| `category` (topic) | `SUPPORT` · `SALES` · `PRICING` · `TECHNICAL` · `GENERAL` |
| `sentiment` | `POSITIVE` · `NEUTRAL` · `NEGATIVE` |

Extracted feature stored on the **assistant message**:

| Feature | Meaning |
| --- | --- |
| `responseTime` | Milliseconds until the AI reply |

---

## Stage 5 — Analysis

When an owner opens analytics, the server loads conversations + assistant timings for that user (optional `agentId`, range `7d` | `30d` | `all`) and computes:

- **Overview KPIs** — conversation count, message count, avg response time, avg length, % positive / negative, top topic  
- **Topics** — category histogram + %  
- **Sentiment** — share of POSITIVE / NEUTRAL / NEGATIVE  
- **Trends** — chats over days or months  
- **Heatmap** — hour-of-day volume  
- **Workload** — chats per agent over time  
- **Insights** — short English summaries from the same aggregates  

Implementation: `getDashboardForUser` / `getOverviewForUser` in `lib/services/analytics.service.js`.

---

## Stage 6 — Database

**Conversation** (features + identity of the thread):

- `category`, `sentiment`, `startedAt`, `agentId`

**Message** (raw + latency):

- `role`, `content`, `responseTime`, `createdAt`

Indexes on `category`, `sentiment`, `startedAt`, `conversationId` keep dashboard queries cheap.

---

## Stage 7 — Dashboard

| UI | API | Shows |
| --- | --- | --- |
| `/analytics` | `GET /api/analytics/dashboard` | All of the owner’s agents |
| `/agents/[id]/analytics` | same + `?agentId=` | One agent |
| Home KPIs | `GET /api/analytics/overview` | High-level counts |

Charts render **only values returned by these APIs**. If nobody has chatted in the selected range, charts stay empty.

---

## Two-speed picture

```
[Chat request]
   → clean message
   → transform (Conversation + Messages)
   → extract (category, sentiment, responseTime)
   → write Database
        ↘ later
[Owner opens Analytics]
   → read Database
   → analysis (aggregates)
   → Dashboard
```

Feature extraction is **online** (per message). Aggregate analysis is **query-time** (per dashboard load). There is no nightly ETL batch in this MVP — Neon already holds the cleaned, featured rows.

---

## How to demo it (interns)

1. Create an agent, add some knowledge, send **5+** chats (happy, angry, pricing, technical).  
2. Open **Conversations** — each thread shows category + sentiment.  
3. Open **Analytics** (workspace and the agent tab) — KPIs, topics, sentiment, and trends should match those chats.  
4. Pick range **7d** vs **all** — older chats drop in or out; no placeholder series.
