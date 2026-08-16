import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";

const RANGES = new Set(["7d", "30d", "all"]);
const PERIODS = new Set(["day", "week", "month"]);

const CATEGORY_LABELS = {
  SUPPORT: "Support",
  SALES: "Sales",
  PRICING: "Pricing",
  TECHNICAL: "Technical",
  GENERAL: "General",
};

const SENTIMENT_LABELS = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
};

function emptyOverview() {
  return {
    totalConversations: 0,
    totalMessages: 0,
    averageResponseTimeMs: 0,
    averageConversationLength: 0,
    positiveSentimentPercent: 0,
    negativeSentimentPercent: 0,
    mostCommonTopic: null,
  };
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date) {
  const d = startOfLocalDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function percent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || "Unclassified";
}

function parseRange(range) {
  const id = RANGES.has(range) ? range : "7d";
  const now = new Date();

  if (id === "7d") {
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 6);
    return { id, start, bucket: "day", buckets: 7 };
  }

  if (id === "30d") {
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - 29);
    return { id, start, bucket: "day", buckets: 30 };
  }

  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return { id, start: null, trendStart: start, bucket: "month", buckets: 12 };
}

function conversationWhere(agentIds, since) {
  return {
    agentId: { in: agentIds },
    ...(since ? { startedAt: { gte: since } } : {}),
  };
}

async function resolveAgents(userId, agentId) {
  if (agentId) {
    const agent = await getAgentForUser(agentId, userId);
    return [{ id: agent.id, name: agent.name }];
  }

  return prisma.agent.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
}

function tally(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function topKey(counts) {
  let best = null;
  let max = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = key;
    }
  }
  return best;
}

function buildOverview(conversations, responseTimes) {
  const totalConversations = conversations.length;
  if (totalConversations === 0) return emptyOverview();

  const totalMessages = conversations.reduce(
    (sum, c) => sum + (c._count?.messages || 0),
    0
  );
  const avgMs =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((sum, n) => sum + n, 0) / responseTimes.length
        )
      : 0;
  const positiveCount = conversations.filter(
    (c) => c.sentiment === "POSITIVE"
  ).length;
  const negativeCount = conversations.filter(
    (c) => c.sentiment === "NEGATIVE"
  ).length;
  const categoryCounts = tally(conversations, (c) => c.category || "GENERAL");
  const mostCommonTopic = topKey(categoryCounts);

  return {
    totalConversations,
    totalMessages,
    averageResponseTimeMs: avgMs,
    averageConversationLength: Number(
      (totalMessages / totalConversations).toFixed(1)
    ),
    positiveSentimentPercent: percent(positiveCount, totalConversations),
    negativeSentimentPercent: percent(negativeCount, totalConversations),
    mostCommonTopic,
  };
}

function buildTopics(conversations) {
  const total = conversations.length;
  const counts = tally(conversations, (c) => c.category || "GENERAL");
  const distribution = ["SUPPORT", "SALES", "PRICING", "TECHNICAL", "GENERAL"]
    .map((category) => ({
      category,
      label: categoryLabel(category),
      count: counts[category] || 0,
      percent: percent(counts[category] || 0, total),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return { distribution, total };
}

function buildSentiment(conversations) {
  const total = conversations.length;
  const counts = tally(conversations, (c) => c.sentiment || "NEUTRAL");
  const distribution = ["POSITIVE", "NEUTRAL", "NEGATIVE"].map((sentiment) => ({
    sentiment,
    label: SENTIMENT_LABELS[sentiment],
    count: counts[sentiment] || 0,
    percent: percent(counts[sentiment] || 0, total),
  }));

  return { distribution, total };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hourLabel(hour) {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function pointKey(date, bucket) {
  const started = new Date(date);
  if (bucket === "day") return ymd(startOfLocalDay(started));
  if (bucket === "week") return ymd(startOfWeekMonday(started));
  return monthKey(started);
}

function createTimeGrid({ start, bucket, buckets }) {
  const points = [];

  if (bucket === "day") {
    for (let i = 0; i < buckets; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const date = ymd(day);
      points.push({
        key: date,
        date,
        label:
          buckets <= 7
            ? day.toLocaleDateString("en-US", { weekday: "short" })
            : day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
    return points;
  }

  if (bucket === "week") {
    const cursor = startOfWeekMonday(start);
    for (let i = 0; i < buckets; i += 1) {
      const week = new Date(cursor);
      week.setDate(cursor.getDate() + i * 7);
      const date = ymd(week);
      points.push({
        key: date,
        date,
        label: week.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
    return points;
  }

  for (let i = 0; i < buckets; i += 1) {
    const month = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = monthKey(month);
    points.push({
      key,
      date: `${key}-01`,
      label: month.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
    });
  }
  return points;
}

function buildTrendPoints(conversations, rangeSpec) {
  const points = createTimeGrid(rangeSpec).map((point) => ({
    ...point,
    conversations: 0,
    messages: 0,
  }));
  const index = Object.fromEntries(points.map((point) => [point.key, point]));

  for (const conversation of conversations) {
    const point = index[pointKey(conversation.startedAt, rangeSpec.bucket)];
    if (!point) continue;
    point.conversations += 1;
    point.messages += conversation._count?.messages || 0;
  }

  return points.map(({ key, ...rest }) => rest);
}

function buildSentimentTrend(conversations, rangeSpec) {
  const points = createTimeGrid(rangeSpec).map((point) => ({
    ...point,
    positive: 0,
    neutral: 0,
    negative: 0,
  }));
  const index = Object.fromEntries(points.map((point) => [point.key, point]));

  for (const conversation of conversations) {
    const point = index[pointKey(conversation.startedAt, rangeSpec.bucket)];
    if (!point) continue;
    const key =
      conversation.sentiment === "POSITIVE"
        ? "positive"
        : conversation.sentiment === "NEGATIVE"
          ? "negative"
          : "neutral";
    point[key] += 1;
  }

  return points.map(({ key, ...rest }) => rest);
}

function buildWorkloadTrend(conversations, agents, rangeSpec) {
  const ranked = [...agents]
    .map((agent) => ({
      ...agent,
      count: conversations.filter((c) => c.agentId === agent.id).length,
    }))
    .sort((a, b) => b.count - a.count);

  const top = ranked.filter((agent) => agent.count > 0).slice(0, 4);
  const topIds = new Set(top.map((agent) => agent.id));
  const hasOther = ranked.some((agent) => agent.count > 0 && !topIds.has(agent.id));

  const series = top.map((agent) => ({ id: agent.id, name: agent.name }));
  if (hasOther) series.push({ id: "other", name: "Other agents" });

  const zeroMap = () => Object.fromEntries(series.map((item) => [item.id, 0]));
  const points = createTimeGrid(rangeSpec).map((point) => ({
    ...point,
    chats: zeroMap(),
    messages: zeroMap(),
    positives: zeroMap(),
  }));
  const index = Object.fromEntries(points.map((point) => [point.key, point]));

  for (const conversation of conversations) {
    const point = index[pointKey(conversation.startedAt, rangeSpec.bucket)];
    if (!point) continue;
    const id = topIds.has(conversation.agentId) ? conversation.agentId : "other";
    if (point.chats[id] == null) continue;
    point.chats[id] += 1;
    point.messages[id] += conversation._count?.messages || 0;
    if (conversation.sentiment === "POSITIVE") point.positives[id] += 1;
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

function buildHeatmap(conversations) {
  const cells = [];
  const map = new Map();
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const cell = { day, hour, count: 0 };
      cells.push(cell);
      map.set(`${day}-${hour}`, cell);
    }
  }

  for (const conversation of conversations) {
    const started = new Date(conversation.startedAt);
    const day = (started.getDay() + 6) % 7;
    const hour = started.getHours();
    const cell = map.get(`${day}-${hour}`);
    if (cell) cell.count += 1;
  }

  const max = cells.reduce((best, cell) => Math.max(best, cell.count), 0);
  const peak = cells.reduce(
    (best, cell) => (cell.count > best.count ? cell : best),
    cells[0]
  );

  return {
    days: WEEKDAYS,
    max,
    peak:
      peak.count > 0
        ? {
            day: peak.day,
            hour: peak.hour,
            count: peak.count,
            label: `${WEEKDAYS[peak.day]} ${hourLabel(peak.hour)}`,
          }
        : null,
    cells,
  };
}

function buildResponseBuckets(responseTimes) {
  const buckets = [
    { id: "fast", label: "< 0.5s", max: 500, count: 0 },
    { id: "ok", label: "0.5–1s", max: 1000, count: 0 },
    { id: "avg", label: "1–2s", max: 2000, count: 0 },
    { id: "slow", label: "2–4s", max: 4000, count: 0 },
    { id: "heavy", label: "4s+", max: Infinity, count: 0 },
  ];

  for (const ms of responseTimes) {
    const bucket = buckets.find((item) => ms < item.max) || buckets[buckets.length - 1];
    bucket.count += 1;
  }

  return buckets.map(({ id, label, count }) => ({ id, label, count }));
}

function buildAgentRows(agents, conversations, responseByAgent) {
  const totalConversations = conversations.length;
  const grouped = Object.fromEntries(
    agents.map((agent) => [
      agent.id,
      {
        id: agent.id,
        name: agent.name,
        conversations: 0,
        messages: 0,
        positives: 0,
        negatives: 0,
        categories: {},
      },
    ])
  );

  for (const conversation of conversations) {
    const row = grouped[conversation.agentId];
    if (!row) continue;
    row.conversations += 1;
    row.messages += conversation._count?.messages || 0;
    if (conversation.sentiment === "POSITIVE") row.positives += 1;
    if (conversation.sentiment === "NEGATIVE") row.negatives += 1;
    const category = conversation.category || "GENERAL";
    row.categories[category] = (row.categories[category] || 0) + 1;
  }

  return agents
    .map((agent) => {
      const row = grouped[agent.id];
      const times = responseByAgent[agent.id] || [];
      const mostCommonTopic = topKey(row.categories);

      return {
        id: agent.id,
        name: agent.name,
        conversations: row.conversations,
        messages: row.messages,
        percent: percent(row.conversations, totalConversations),
        positiveSentimentPercent: percent(row.positives, row.conversations),
        negativeSentimentPercent: percent(row.negatives, row.conversations),
        averageResponseTimeMs:
          times.length > 0
            ? Math.round(times.reduce((sum, n) => sum + n, 0) / times.length)
            : 0,
        averageConversationLength:
          row.conversations > 0
            ? Number((row.messages / row.conversations).toFixed(1))
            : 0,
        mostCommonTopic,
        topicCounts: row.categories,
      };
    })
    .sort((a, b) => b.conversations - a.conversations || a.name.localeCompare(b.name));
}

function buildInsights({ overview, topics, sentiment, trends, agents, heatmap, scoped }) {
  if (overview.totalConversations === 0) {
    return [
      {
        title: "No conversations yet",
        detail: scoped
          ? "Chat with this agent to populate its analytics."
          : "Start a chat with any of your agents to populate workspace analytics.",
      },
    ];
  }

  const insights = [];
  const topTopic = topics.distribution.find((item) => item.count > 0);
  if (topTopic) {
    insights.push({
      title: `${topTopic.label} is the top topic`,
      detail: `${topTopic.percent}% of conversations (${topTopic.count}) are ${topTopic.label.toLowerCase()}.`,
    });
  }

  const positive = sentiment.distribution.find((item) => item.sentiment === "POSITIVE");
  const negative = sentiment.distribution.find((item) => item.sentiment === "NEGATIVE");
  if (positive) {
    insights.push({
      title:
        positive.percent >= 50
          ? "Sentiment is mostly positive"
          : "Sentiment is mixed",
      detail: `${positive.percent}% positive, ${negative?.percent ?? 0}% negative.`,
    });
  }

  const busiest = trends.points.reduce(
    (best, point) => (point.conversations > best.conversations ? point : best),
    trends.points[0] || { conversations: 0, messages: 0, label: "" }
  );
  if (busiest?.conversations > 0) {
    insights.push({
      title: `Busiest ${trends.period === "month" ? "month" : "day"}: ${busiest.label}`,
      detail: `${busiest.conversations} conversations and ${busiest.messages} messages.`,
    });
  }

  if (heatmap?.peak) {
    insights.push({
      title: `Peak hour is ${heatmap.peak.label}`,
      detail: `${heatmap.peak.count} chats started in that hour across this range.`,
    });
  }

  if (overview.averageResponseTimeMs > 0) {
    const ms = overview.averageResponseTimeMs;
    const pretty = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
    insights.push({
      title: "Average AI response time",
      detail: `Assistants reply in about ${pretty} in this range.`,
    });
  }

  if (!scoped && agents.length > 1) {
    const leader = agents.find((agent) => agent.conversations > 0);
    if (leader) {
      insights.push({
        title: `${leader.name} handles the most chats`,
        detail: `${leader.conversations} conversations · ${leader.percent}% of workspace volume.`,
      });
    }
  }

  return insights.slice(0, 6);
}

async function loadAssistantTimes(agentIds, since) {
  if (agentIds.length === 0) return [];

  return prisma.message.findMany({
    where: {
      role: "ASSISTANT",
      responseTime: { not: null },
      conversation: conversationWhere(agentIds, since),
    },
    select: {
      responseTime: true,
      conversation: { select: { agentId: true } },
    },
  });
}

async function loadBundle(userId, { agentId, since } = {}) {
  const agents = await resolveAgents(userId, agentId);
  const agentIds = agents.map((agent) => agent.id);

  if (agentIds.length === 0) {
    return { agents, conversations: [], assistantTimes: [] };
  }

  const [conversations, assistantTimes] = await Promise.all([
    prisma.conversation.findMany({
      where: conversationWhere(agentIds, since),
      select: {
        id: true,
        agentId: true,
        category: true,
        sentiment: true,
        startedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    loadAssistantTimes(agentIds, since),
  ]);

  return { agents, conversations, assistantTimes };
}

function composeAnalytics({
  agents,
  conversations,
  assistantTimes,
  rangeInfo,
  scoped,
}) {
  const responseTimes = assistantTimes.map((row) => row.responseTime);
  const responseByAgent = {};
  for (const row of assistantTimes) {
    const id = row.conversation.agentId;
    if (!responseByAgent[id]) responseByAgent[id] = [];
    responseByAgent[id].push(row.responseTime);
  }

  const overview = buildOverview(conversations, responseTimes);
  const topics = buildTopics(conversations);
  const sentiment = buildSentiment(conversations);
  const trendStart =
    rangeInfo.bucket === "month"
      ? rangeInfo.trendStart || rangeInfo.start
      : rangeInfo.start;
  const trends = {
    period: rangeInfo.bucket,
    points: buildTrendPoints(conversations, {
      start: trendStart,
      bucket: rangeInfo.bucket,
      buckets: rangeInfo.buckets,
    }),
  };
  const rangeSpec = {
    start: trendStart,
    bucket: rangeInfo.bucket,
    buckets: rangeInfo.buckets,
  };
  const agentRows = buildAgentRows(agents, conversations, responseByAgent);
  const heatmap = buildHeatmap(conversations);
  const sentimentTrend = buildSentimentTrend(conversations, rangeSpec);
  const workloadTrend = buildWorkloadTrend(conversations, agents, rangeSpec);
  const responseBuckets = buildResponseBuckets(responseTimes);
  const insights = buildInsights({
    overview,
    topics,
    sentiment,
    trends,
    agents: agentRows,
    heatmap,
    scoped,
  });

  const activeAgents = agentRows.filter((agent) => agent.conversations > 0).length;

  return {
    range: rangeInfo.id,
    scoped,
    agentCount: agents.length,
    activeAgents,
    overview,
    topics,
    sentiment,
    trends,
    sentimentTrend,
    workloadTrend,
    heatmap,
    responseBuckets,
    agents: agentRows,
    insights,
  };
}

/**
 * KPI aggregates for all of a user's agents, or one agent when agentId is set.
 * Optional range: 7d | 30d | all (default all, used by Home).
 */
export async function getOverviewForUser(userId, { agentId, range } = {}) {
  const rangeInfo = parseRange(range || "all");
  const since = rangeInfo.id === "all" ? null : rangeInfo.start;
  const { conversations, assistantTimes } = await loadBundle(userId, {
    agentId,
    since,
  });
  return buildOverview(
    conversations,
    assistantTimes.map((row) => row.responseTime)
  );
}

export async function getTopicsForUser(userId, { agentId } = {}) {
  const { conversations } = await loadBundle(userId, { agentId, since: null });
  const topics = buildTopics(conversations);
  return {
    distribution: topics.distribution.map(({ category, count, percent: value }) => ({
      category,
      count,
      percent: value,
    })),
    total: topics.total,
  };
}

export async function getSentimentForUser(userId, { agentId } = {}) {
  const { conversations } = await loadBundle(userId, { agentId, since: null });
  const sentiment = buildSentiment(conversations);
  return {
    distribution: sentiment.distribution.map(
      ({ sentiment: key, count, percent: value }) => ({
        sentiment: key,
        count,
        percent: value,
      })
    ),
    total: sentiment.total,
  };
}

export async function getTrendsForUser(
  userId,
  { agentId, period = "day", days = 7 } = {}
) {
  const safePeriod = PERIODS.has(period) ? period : "day";
  const lookback = Math.min(Math.max(Number(days) || 7, 1), 366);
  const start = startOfLocalDay(new Date());
  start.setDate(start.getDate() - (lookback - 1));

  let bucket = "day";
  let buckets = lookback;
  let trendStart = start;

  if (safePeriod === "week") {
    bucket = "week";
    trendStart = startOfWeekMonday(start);
    buckets = Math.max(1, Math.ceil(lookback / 7));
  } else if (safePeriod === "month") {
    bucket = "month";
    trendStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const end = new Date();
    buckets =
      (end.getFullYear() - trendStart.getFullYear()) * 12 +
      (end.getMonth() - trendStart.getMonth()) +
      1;
  }

  const { conversations } = await loadBundle(userId, { agentId, since: start });

  return {
    period: safePeriod,
    points: buildTrendPoints(conversations, {
      start: trendStart,
      bucket,
      buckets,
    }).map(({ date, conversations: count, messages }) => ({
      date,
      conversations: count,
      messages,
    })),
  };
}

export async function getDashboardForUser(userId, { agentId, range } = {}) {
  const rangeInfo = parseRange(range);
  const since = rangeInfo.id === "all" ? null : rangeInfo.start;
  const scoped = Boolean(agentId);
  const bundle = await loadBundle(userId, { agentId, since });

  if (rangeInfo.id === "all") {
    rangeInfo.start = rangeInfo.trendStart;
  }

  return composeAnalytics({
    ...bundle,
    rangeInfo,
    scoped,
  });
}

export function assertAnalyticsQuery({ range, period, days } = {}) {
  if (range != null && range !== "" && !RANGES.has(range)) {
    throw httpError(400, "range must be 7d, 30d, or all");
  }
  if (period != null && period !== "" && !PERIODS.has(period)) {
    throw httpError(400, "period must be day, week, or month");
  }
  if (days != null && days !== "") {
    const n = Number(days);
    if (!Number.isFinite(n) || n < 1 || n > 366) {
      throw httpError(400, "days must be between 1 and 366");
    }
  }
}
