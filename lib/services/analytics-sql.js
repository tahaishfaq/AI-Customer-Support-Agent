import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

/** Match JS chart grid (local/server TZ), not Neon UTC date_trunc. */
function analyticsTz() {
  return (
    process.env.ANALYTICS_TZ ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC"
  );
}

function tzSqlLiteral() {
  return analyticsTz().replace(/'/g, "''");
}

function tzRaw() {
  return Prisma.raw(`'${tzSqlLiteral()}'`);
}

function bucketKeyExpr(columnSql, bucket) {
  const tz = tzSqlLiteral();
  if (bucket === "hour") {
    return Prisma.raw(
      `(to_char((${columnSql}) AT TIME ZONE '${tz}', 'YYYY-MM-DD') || 'T' || to_char((${columnSql}) AT TIME ZONE '${tz}', 'HH24'))`
    );
  }
  if (bucket === "day") {
    return Prisma.raw(
      `to_char((${columnSql}) AT TIME ZONE '${tz}', 'YYYY-MM-DD')`
    );
  }
  if (bucket === "week") {
    return Prisma.raw(
      `to_char(date_trunc('week', (${columnSql}) AT TIME ZONE '${tz}'), 'YYYY-MM-DD')`
    );
  }
  return Prisma.raw(`to_char((${columnSql}) AT TIME ZONE '${tz}', 'YYYY-MM')`);
}

function rowBucketKey(row, rangeSpec) {
  if (row.bucket_key != null) return String(row.bucket_key);
  if (row.bucket == null) return null;
  const bucket = row.bucket instanceof Date ? row.bucket : new Date(row.bucket);
  return rangeSpec.pointKey(bucket);
}

function mergeCountsIntoGrid(rows, rangeSpec) {
  const points = rangeSpec.grid.map((point) => ({
    ...point,
    count: 0,
  }));
  const index = Object.fromEntries(points.map((point) => [point.key, point]));
  for (const row of rows) {
    const key = rowBucketKey(row, rangeSpec);
    const point = key ? index[key] : null;
    if (point) point.count += Number(row.count || 0);
  }
  return points.map(({ key, ...rest }) => rest);
}

function conversationWhere(agentIds, since) {
  return {
    agentId: { in: agentIds },
    ...(since ? { startedAt: { gte: since } } : {}),
  };
}

export async function loadExactKpis(agentIds, since) {
  if (agentIds.length === 0) return null;

  const where = conversationWhere(agentIds, since);
  const [conversationCount, messageCount, avgAgg, categoryGroups, sentimentGroups] =
    await Promise.all([
      prisma.conversation.count({ where }),
      prisma.message.count({ where: { conversation: where } }),
      prisma.message.aggregate({
        where: {
          role: "ASSISTANT",
          responseTime: { not: null },
          conversation: where,
        },
        _avg: { responseTime: true },
      }),
      prisma.conversation.groupBy({
        by: ["category"],
        where,
        _count: { _all: true },
      }),
      prisma.conversation.groupBy({
        by: ["sentiment"],
        where,
        _count: { _all: true },
      }),
    ]);

  return {
    conversationCount,
    messageCount,
    avgResponseTimeMs: Math.round(avgAgg._avg.responseTime || 0),
    categoryGroups,
    sentimentGroups,
    truncated: conversationCount > 8_000,
    sampleCap: 8_000,
  };
}

export async function loadTrendPointsSql(agentIds, since, rangeSpec) {
  const emptyPoints = rangeSpec.grid.map(({ key, ...rest }) => ({
    ...rest,
    conversations: 0,
    messages: 0,
  }));

  if (agentIds.length === 0 || !since) {
    return { period: rangeSpec.bucket, points: emptyPoints };
  }

  const keyExpr = bucketKeyExpr('c."startedAt"', rangeSpec.bucket);
  const rows = await prisma.$queryRaw`
    SELECT
      ${keyExpr} AS bucket_key,
      COUNT(DISTINCT c.id)::int AS conversations,
      COUNT(m.id)::int AS messages
    FROM "Conversation" c
    LEFT JOIN "Message" m ON m."conversationId" = c.id
    WHERE c."agentId" IN (${Prisma.join(agentIds)})
      AND c."startedAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `;

  const points = rangeSpec.grid.map((point) => ({
    ...point,
    conversations: 0,
    messages: 0,
  }));
  const index = Object.fromEntries(points.map((point) => [point.key, point]));

  for (const row of rows) {
    const key = rowBucketKey(row, rangeSpec);
    const point = key ? index[key] : null;
    if (!point) continue;
    point.conversations += row.conversations;
    point.messages += row.messages;
  }

  return {
    period: rangeSpec.bucket,
    points: points.map(({ key, ...rest }) => rest),
  };
}

export async function loadSentimentTrendSql(agentIds, since, rangeSpec) {
  const emptyPoints = rangeSpec.grid.map(({ key, ...rest }) => ({
    ...rest,
    positive: 0,
    neutral: 0,
    negative: 0,
  }));

  if (agentIds.length === 0 || !since) return emptyPoints;

  const keyExpr = bucketKeyExpr('c."startedAt"', rangeSpec.bucket);
  const rows = await prisma.$queryRaw`
    SELECT
      ${keyExpr} AS bucket_key,
      c.sentiment,
      COUNT(*)::int AS count
    FROM "Conversation" c
    WHERE c."agentId" IN (${Prisma.join(agentIds)})
      AND c."startedAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1
  `;

  const points = rangeSpec.grid.map((point) => ({
    ...point,
    positive: 0,
    neutral: 0,
    negative: 0,
  }));
  const index = Object.fromEntries(points.map((point) => [point.key, point]));

  for (const row of rows) {
    const key = rowBucketKey(row, rangeSpec);
    const point = key ? index[key] : null;
    if (!point) continue;
    if (row.sentiment === "POSITIVE") point.positive += row.count;
    else if (row.sentiment === "NEGATIVE") point.negative += row.count;
    else point.neutral += row.count;
  }

  return points.map(({ key, ...rest }) => rest);
}

export async function loadHeatmapSql(agentIds, since, weekdays, hourLabel) {
  const cells = [];
  const map = new Map();
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const cell = { day, hour, count: 0 };
      cells.push(cell);
      map.set(`${day}-${hour}`, cell);
    }
  }

  if (agentIds.length === 0 || !since) {
    return { days: weekdays, max: 0, peak: null, cells };
  }

  const tz = tzRaw();
  const rows = await prisma.$queryRaw`
    SELECT
      ((EXTRACT(DOW FROM c."startedAt" AT TIME ZONE ${tz})::int + 6) % 7)::int AS day,
      EXTRACT(HOUR FROM c."startedAt" AT TIME ZONE ${tz})::int AS hour,
      COUNT(*)::int AS count
    FROM "Conversation" c
    WHERE c."agentId" IN (${Prisma.join(agentIds)})
      AND c."startedAt" >= ${since}
    GROUP BY 1, 2
  `;

  for (const row of rows) {
    const cell = map.get(`${row.day}-${row.hour}`);
    if (cell) cell.count += row.count;
  }

  const max = cells.reduce((best, cell) => Math.max(best, cell.count), 0);
  const peak = cells.reduce(
    (best, cell) => (cell.count > best.count ? cell : best),
    cells[0]
  );

  return {
    days: weekdays,
    max,
    peak:
      peak.count > 0
        ? {
            day: peak.day,
            hour: peak.hour,
            count: peak.count,
            label: `${weekdays[peak.day]} ${hourLabel(peak.hour)}`,
          }
        : null,
    cells,
  };
}

export async function loadAgentStatsSql(agentIds, since) {
  if (agentIds.length === 0) return new Map();

  const where = conversationWhere(agentIds, since);
  const [byAgent, byCategory, bySentiment, messageRows] = await Promise.all([
    prisma.conversation.groupBy({
      by: ["agentId"],
      where,
      _count: { _all: true },
    }),
    prisma.conversation.groupBy({
      by: ["agentId", "category"],
      where,
      _count: { _all: true },
    }),
    prisma.conversation.groupBy({
      by: ["agentId", "sentiment"],
      where,
      _count: { _all: true },
    }),
    prisma.$queryRaw`
      SELECT c."agentId", COUNT(m.id)::int AS messages
      FROM "Conversation" c
      JOIN "Message" m ON m."conversationId" = c.id
      WHERE c."agentId" IN (${Prisma.join(agentIds)})
        AND c."startedAt" >= ${since}
      GROUP BY c."agentId"
    `,
  ]);

  const stats = new Map();
  for (const row of byAgent) {
    stats.set(row.agentId, {
      conversations: row._count._all,
      messages: 0,
      positives: 0,
      negatives: 0,
      categories: {},
    });
  }

  for (const row of messageRows) {
    const entry = stats.get(row.agentId);
    if (entry) entry.messages = row.messages;
  }

  for (const row of byCategory) {
    const entry = stats.get(row.agentId);
    if (!entry) continue;
    const category = row.category || "GENERAL";
    entry.categories[category] = row._count._all;
  }

  for (const row of bySentiment) {
    const entry = stats.get(row.agentId);
    if (!entry) continue;
    if (row.sentiment === "POSITIVE") entry.positives = row._count._all;
    if (row.sentiment === "NEGATIVE") entry.negatives = row._count._all;
  }

  return stats;
}

export async function loadWorkloadTrendSql(agentIds, since, rangeSpec, agents, agentStats) {
  const ranked = [...agentStats.entries()]
    .map(([id, stats]) => ({
      id,
      name: agents.find((agent) => agent.id === id)?.name || "Agent",
      count: stats.conversations,
    }))
    .sort((a, b) => b.count - a.count);

  const top = ranked.filter((agent) => agent.count > 0).slice(0, 4);
  const topIds = new Set(top.map((agent) => agent.id));
  const hasOther = ranked.some((agent) => agent.count > 0 && !topIds.has(agent.id));

  const series = top.map((agent) => ({ id: agent.id, name: agent.name }));
  if (hasOther) series.push({ id: "other", name: "Other agents" });

  const zeroMap = () => Object.fromEntries(series.map((item) => [item.id, 0]));
  const points = rangeSpec.grid.map((point) => ({
    ...point,
    chats: zeroMap(),
    messages: zeroMap(),
    positives: zeroMap(),
  }));

  if (agentIds.length === 0 || !since || series.length === 0) {
    return {
      series,
      points: points.map(({ key, chats, messages, positives, ...rest }) => ({
        ...rest,
        values: chats,
        chats,
        messages,
        positives,
      })),
    };
  }

  const keyExpr = bucketKeyExpr('c."startedAt"', rangeSpec.bucket);
  const rows = await prisma.$queryRaw`
    SELECT
      ${keyExpr} AS bucket_key,
      c."agentId",
      COUNT(DISTINCT c.id)::int AS chats,
      COUNT(m.id)::int AS messages,
      SUM(CASE WHEN c.sentiment = 'POSITIVE' THEN 1 ELSE 0 END)::int AS positives
    FROM "Conversation" c
    LEFT JOIN "Message" m ON m."conversationId" = c.id
    WHERE c."agentId" IN (${Prisma.join(agentIds)})
      AND c."startedAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1
  `;

  const index = Object.fromEntries(points.map((point) => [point.key, point]));
  for (const row of rows) {
    const key = rowBucketKey(row, rangeSpec);
    const point = key ? index[key] : null;
    if (!point) continue;
    const id = topIds.has(row.agentId) ? row.agentId : "other";
    if (point.chats[id] == null) continue;
    point.chats[id] += row.chats;
    point.messages[id] += row.messages;
    point.positives[id] += row.positives;
  }

  return {
    series,
    points: points.map(({ key, chats, messages, positives, ...rest }) => ({
      ...rest,
      values: chats,
      chats,
      messages,
      positives,
    })),
  };
}

export async function loadPlatformGrowthSql(rangeSpec) {
  const since = rangeSpec.start;
  const empty = rangeSpec.grid.map(({ key, date, label }) => ({ date, label, count: 0 }));

  if (!since) {
    return { userPoints: empty, agentPoints: empty, embedPoints: empty };
  }

  const userKey = bucketKeyExpr('"createdAt"', rangeSpec.bucket);
  const agentKey = bucketKeyExpr('"createdAt"', rangeSpec.bucket);
  const embedKey = bucketKeyExpr('COALESCE("siteCrawledAt", "createdAt")', rangeSpec.bucket);
  const [userRows, agentRows, embedRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT ${userKey} AS bucket_key, COUNT(*)::int AS count
      FROM "User"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw`
      SELECT ${agentKey} AS bucket_key, COUNT(*)::int AS count
      FROM "Agent"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw`
      SELECT ${embedKey} AS bucket_key, COUNT(*)::int AS count
      FROM "Agent"
      WHERE "siteKnowledgeOrigin" IS NOT NULL
        AND COALESCE("siteCrawledAt", "createdAt") >= ${since}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  return {
    userPoints: mergeCountsIntoGrid(userRows, rangeSpec),
    agentPoints: mergeCountsIntoGrid(agentRows, rangeSpec),
    embedPoints: mergeCountsIntoGrid(embedRows, rangeSpec),
  };
}

export async function loadSqlCharts(agentIds, since, rangeSpec, agents, helpers) {
  const agentStats = await loadAgentStatsSql(agentIds, since);
  const [trends, sentimentTrend, heatmap, workloadTrend] = await Promise.all([
    loadTrendPointsSql(agentIds, since, rangeSpec),
    loadSentimentTrendSql(agentIds, since, rangeSpec),
    loadHeatmapSql(agentIds, since, helpers.weekdays, helpers.hourLabel),
    loadWorkloadTrendSql(agentIds, since, rangeSpec, agents, agentStats),
  ]);

  return { trends, sentimentTrend, heatmap, workloadTrend, agentStats };
}
