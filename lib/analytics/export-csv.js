/**
 * Client-safe CSV builders for analytics dashboards (W3-6).
 */

export function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function rowsToCsv(columns, rows) {
  const header = columns.map((col) => csvEscape(col.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => csvEscape(col.value(row))).join(",")
  );
  return [header, ...lines].join("\n");
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replaceAll(":", "-");
}

export function exportFilename(scope, range, kind) {
  return `aide-analytics-${scope}-${range}-${kind}-${stamp()}.csv`;
}

export function downloadCsv(filename, body) {
  if (typeof window === "undefined") {
    throw new Error("downloadCsv is browser-only");
  }
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildSummaryCsv(data, { scope, range }) {
  const overview = data?.overview || {};
  const rows = [
    { field: "exportedAt", value: new Date().toISOString() },
    { field: "scope", value: scope },
    { field: "range", value: range },
    { field: "totalConversations", value: overview.totalConversations ?? 0 },
    { field: "totalMessages", value: overview.totalMessages ?? 0 },
    { field: "averageResponseTimeMs", value: overview.averageResponseTimeMs ?? 0 },
    {
      field: "averageConversationLength",
      value: overview.averageConversationLength ?? 0,
    },
    {
      field: "positiveSentimentPercent",
      value: overview.positiveSentimentPercent ?? 0,
    },
    {
      field: "negativeSentimentPercent",
      value: overview.negativeSentimentPercent ?? 0,
    },
    { field: "mostCommonTopic", value: overview.mostCommonTopic || "" },
    { field: "agentCount", value: data?.agentCount ?? "" },
    { field: "activeAgents", value: data?.activeAgents ?? "" },
  ];

  if (data?.platform) {
    rows.push(
      { field: "platformUsers", value: data.platform.users ?? 0 },
      { field: "platformWorkspaces", value: data.platform.workspaces ?? 0 },
      { field: "platformAgents", value: data.platform.agents ?? 0 },
      { field: "platformLiveEmbeds", value: data.platform.liveEmbeds ?? 0 },
      {
        field: "platformConversationsTotal",
        value: data.platform.conversationsTotal ?? 0,
      }
    );
  }

  if (data?.sample?.truncated) {
    rows.push(
      { field: "sampleTruncated", value: "true" },
      { field: "sampleCap", value: data.sample.cap ?? "" },
      {
        field: "sampleTotalConversations",
        value: data.sample.totalConversations ?? "",
      }
    );
  }

  return rowsToCsv(
    [
      { label: "field", value: (row) => row.field },
      { label: "value", value: (row) => row.value },
    ],
    rows
  );
}

export function buildAgentsCsv(agents = []) {
  return rowsToCsv(
    [
      { label: "agent", value: (row) => row.name },
      { label: "conversations", value: (row) => row.conversations ?? 0 },
      { label: "sharePercent", value: (row) => row.percent ?? 0 },
      { label: "messages", value: (row) => row.messages ?? 0 },
      { label: "avgResponseTimeMs", value: (row) => row.averageResponseTimeMs ?? 0 },
      {
        label: "positiveSentimentPercent",
        value: (row) => row.positiveSentimentPercent ?? 0,
      },
      {
        label: "negativeSentimentPercent",
        value: (row) => row.negativeSentimentPercent ?? 0,
      },
      { label: "topTopic", value: (row) => row.mostCommonTopic || "" },
      { label: "website", value: (row) => row.siteKnowledgeOrigin || "" },
      { label: "ownerEmail", value: (row) => row.ownerEmail || "" },
    ],
    agents
  );
}

export function buildTrendsCsv(points = []) {
  return rowsToCsv(
    [
      { label: "date", value: (row) => row.date },
      { label: "label", value: (row) => row.label },
      { label: "conversations", value: (row) => row.conversations ?? 0 },
      { label: "messages", value: (row) => row.messages ?? 0 },
    ],
    points
  );
}

export function buildTopicsCsv(distribution = []) {
  return rowsToCsv(
    [
      { label: "category", value: (row) => row.category },
      { label: "label", value: (row) => row.label },
      { label: "count", value: (row) => row.count ?? 0 },
      { label: "percent", value: (row) => row.percent ?? 0 },
    ],
    distribution
  );
}

export function buildSentimentCsv(distribution = []) {
  return rowsToCsv(
    [
      { label: "sentiment", value: (row) => row.sentiment },
      { label: "label", value: (row) => row.label },
      { label: "count", value: (row) => row.count ?? 0 },
      { label: "percent", value: (row) => row.percent ?? 0 },
    ],
    distribution
  );
}

export function buildGrowthCsv(points = []) {
  return rowsToCsv(
    [
      { label: "date", value: (row) => row.date },
      { label: "label", value: (row) => row.label },
      { label: "users", value: (row) => row.users ?? 0 },
      { label: "agents", value: (row) => row.agents ?? 0 },
      { label: "embeds", value: (row) => row.embeds ?? 0 },
      { label: "chats", value: (row) => row.chats ?? 0 },
    ],
    points
  );
}

export function buildExport(kind, data, meta) {
  switch (kind) {
    case "summary":
      return buildSummaryCsv(data, meta);
    case "agents":
      return buildAgentsCsv(data?.agents || []);
    case "trends":
      return buildTrendsCsv(data?.trends?.points || []);
    case "topics":
      return buildTopicsCsv(data?.topics?.distribution || []);
    case "sentiment":
      return buildSentimentCsv(data?.sentiment?.distribution || []);
    case "growth":
      return buildGrowthCsv(data?.growth?.points || []);
    default:
      throw new Error(`Unknown analytics export kind: ${kind}`);
  }
}
