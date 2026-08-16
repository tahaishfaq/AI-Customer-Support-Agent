"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartEmpty } from "@/components/analytics/AnalyticsCharts";
import { cn } from "@/lib/utils";

const TEAL = "#0b5f58";
const SKY = "#0284c7";
const GREEN = "#16a34a";
const SLATE = "#94a3b8";
const RED = "#dc2626";
const PALETTE = [TEAL, SKY, "#d97706", "#7c3aed", "#64748b"];

const volumeConfig = {
  conversations: { label: "Chats", color: TEAL },
  messages: { label: "Messages", color: SKY },
};

function ChartViewPills({ value, onChange, options }) {
  return (
    <div className="mb-3 flex justify-end">
      <div className="inline-flex rounded-full bg-[#f1f5f9] p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium",
              value === option.id
                ? "bg-white text-[var(--color-text)] shadow-sm ring-1 ring-black/5"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const interactiveConfig = {
  activity: { label: "Activity" },
  conversations: { label: "Chats", color: "var(--chart-1)" },
  messages: { label: "Messages", color: "var(--chart-2)" },
};

const RANGE_COPY = {
  "7d": {
    title: "Last 7 days",
    description: "Showing chats and messages for the last 7 days",
  },
  "30d": {
    title: "Last 30 days",
    description: "Showing chats and messages for the last 30 days",
  },
  all: {
    title: "All time",
    description: "Showing chats and messages for all time",
  },
};

const sentimentConfig = {
  positive: { label: "Positive", color: GREEN },
  neutral: { label: "Neutral", color: SLATE },
  negative: { label: "Negative", color: RED },
};

const latencyConfig = {
  count: { label: "Replies", color: TEAL },
};

const WORKLOAD_METRICS = [
  { id: "chats", label: "Chats" },
  { id: "messages", label: "Messages" },
  { id: "positives", label: "Positive" },
];

function hasSeries(rows, keys) {
  return rows.some((row) => keys.some((key) => Number(row[key]) > 0));
}

export function ChartAreaInteractive({
  points = [],
  range = "7d",
  onRangeChange,
  loading = false,
}) {
  const copy = RANGE_COPY[range] || RANGE_COPY["7d"];

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Volume over time</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </div>
        <Select value={range} onValueChange={onRangeChange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a time range"
          >
            <SelectValue placeholder="Last 7 days">{copy.title}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="all" className="rounded-lg">
              All time
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div className="h-[250px] w-full animate-pulse rounded-lg bg-[var(--color-bg)]" />
        ) : !hasSeries(points, ["conversations", "messages"]) ? (
          <ChartEmpty message="No chats in this range yet." />
        ) : (
          <ChartContainer config={interactiveConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={points}>
              <defs>
                <linearGradient id="fillConversations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-conversations)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-conversations)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillMessages" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-messages)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-messages)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  if (Number.isNaN(date.getTime())) return String(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      if (Number.isNaN(date.getTime())) return String(value);
                      return date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="messages"
                type="natural"
                fill="url(#fillMessages)"
                stroke="var(--color-messages)"
                stackId="a"
              />
              <Area
                dataKey="conversations"
                type="natural"
                fill="url(#fillConversations)"
                stroke="var(--color-conversations)"
                stackId="a"
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const VOLUME_VIEWS = [
  { id: "lines", label: "Lines" },
  { id: "bars", label: "Bars" },
];

const SENTIMENT_VIEWS = [
  { id: "lines", label: "Lines" },
  { id: "stack", label: "Stacked" },
];

function VolumeBarChart({ points }) {
  const fillId = useId().replace(/:/g, "");
  const chatsFill = `chats-${fillId}`;
  const messagesFill = `msgs-${fillId}`;

  if (!hasSeries(points, ["conversations", "messages"])) return <ChartEmpty />;

  return (
    <ChartContainer config={volumeConfig} className="aspect-auto h-[240px] w-full">
      <BarChart
        accessibilityLayer
        data={points}
        barGap={6}
        barCategoryGap="22%"
        margin={{ left: 4, right: 4, top: 22, bottom: 0 }}
      >
        <defs>
          <linearGradient id={chatsFill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#159086" />
            <stop offset="100%" stopColor={TEAL} />
          </linearGradient>
          <linearGradient id={messagesFill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor={SKY} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e8eef3" strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={{ fill: "#64748b", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
        />
        <ChartTooltip cursor={{ fill: "#f1f5f9", radius: 6 }} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="conversations"
          fill={`url(#${chatsFill})`}
          maxBarSize={36}
          radius={[6, 6, 0, 0]}
        >
          <LabelList
            dataKey="conversations"
            position="top"
            offset={6}
            formatter={(value) => (value > 0 ? value : "")}
            className="fill-[#0f172a] text-[10px] font-medium"
          />
        </Bar>
        <Bar
          dataKey="messages"
          fill={`url(#${messagesFill})`}
          maxBarSize={36}
          radius={[6, 6, 0, 0]}
        >
          <LabelList
            dataKey="messages"
            position="top"
            offset={6}
            formatter={(value) => (value > 0 ? value : "")}
            className="fill-[#0f172a] text-[10px] font-medium"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function VolumeTrendChart({ points = [] }) {
  const [view, setView] = useState("lines");
  if (!hasSeries(points, ["conversations", "messages"])) return <ChartEmpty />;

  return (
    <div>
      <ChartViewPills value={view} onChange={setView} options={VOLUME_VIEWS} />
      {view === "bars" ? (
        <VolumeBarChart points={points} />
      ) : (
        <ChartContainer config={volumeConfig} className="aspect-auto h-[240px] w-full">
          <LineChart accessibilityLayer data={points} margin={{ left: 8, right: 8, top: 12 }}>
            <CartesianGrid vertical={false} stroke="#e8eef3" strokeDasharray="3 6" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: "#64748b", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={28}
              allowDecimals={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="linear"
              dataKey="conversations"
              stroke={TEAL}
              strokeWidth={2.5}
              dot={{ r: 4, fill: TEAL, stroke: "#fff", strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="linear"
              dataKey="messages"
              stroke={SKY}
              strokeWidth={2.5}
              dot={{ r: 4, fill: SKY, stroke: "#fff", strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}

/** Three independent lines — not stacked area. */
export function StackedSentimentChart({ points = [] }) {
  if (!hasSeries(points, ["positive", "neutral", "negative"])) return <ChartEmpty />;

  return (
    <ChartContainer config={sentimentConfig} className="aspect-auto h-[220px] w-full">
      <LineChart accessibilityLayer data={points} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line type="linear" dataKey="positive" stroke={GREEN} strokeWidth={2.5} dot={{ r: 3 }} />
        <Line type="linear" dataKey="neutral" stroke={SLATE} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2.5 }} />
        <Line type="linear" dataKey="negative" stroke={RED} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ChartContainer>
  );
}

export function SentimentOverTimeChart({ points = [] }) {
  const [view, setView] = useState("lines");
  if (!hasSeries(points, ["positive", "neutral", "negative"])) {
    return <ChartEmpty message="No labeled sentiment in this range yet." />;
  }

  return (
    <div>
      <ChartViewPills value={view} onChange={setView} options={SENTIMENT_VIEWS} />
      {view === "lines" ? (
        <StackedSentimentChart points={points} />
      ) : (
        <ChartContainer config={sentimentConfig} className="aspect-auto h-[220px] w-full">
          <BarChart accessibilityLayer data={points} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="positive" stackId="s" fill={GREEN} radius={[0, 0, 0, 0]} />
            <Bar dataKey="neutral" stackId="s" fill={SLATE} />
            <Bar dataKey="negative" stackId="s" fill={RED} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}

export function ActivityHeatmap({ heatmap }) {
  const [hover, setHover] = useState(null);
  const cells = heatmap?.cells || [];
  const max = heatmap?.max || 0;
  if (!cells.length || max === 0) {
    return <ChartEmpty message="No chats in this range to map by hour." />;
  }

  const cellW = 18;
  const cellH = 16;
  const labelW = 36;
  const top = 22;
  const width = labelW + 24 * cellW + 8;
  const height = top + 7 * cellH + 8;

  function fill(count) {
    if (!count) return "#f1f5f9";
    const t = count / max;
    return `rgba(11, 95, 88, ${0.18 + t * 0.82})`;
  }

  const hourLabel = (hour) =>
    hour === 0 ? "12a" : hour === 12 ? "12p" : hour < 12 ? `${hour}a` : `${hour - 12}p`;

  const active = hover
    ? cells.find((cell) => cell.day === hover.day && cell.hour === hover.hour)
    : null;

  return (
    <div>
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-[var(--color-muted)]">
          Darker cells are busier. Peak:{" "}
          <span className="font-medium text-[var(--color-text)]">{heatmap.peak?.label || "—"}</span>
        </p>
        <p className="text-[12px] tabular-nums text-[var(--color-text-secondary)]">
          {active
            ? `${heatmap.days[active.day]} ${hourLabel(active.hour)} — ${active.count} chats`
            : "Hover a cell for the exact hour"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[188px] min-w-[560px] w-full"
          role="img"
          aria-label="Activity by weekday and hour"
        >
          {Array.from({ length: 24 }, (_, hour) =>
            hour % 3 === 0 ? (
              <text
                key={`h-${hour}`}
                x={labelW + hour * cellW + cellW / 2}
                y={12}
                textAnchor="middle"
                fontSize="9"
                className="fill-[var(--color-muted)]"
              >
                {hourLabel(hour)}
              </text>
            ) : null
          )}
          {heatmap.days.map((day, dayIndex) => (
            <g key={day}>
              <text
                x={labelW - 6}
                y={top + dayIndex * cellH + cellH / 2 + 3}
                textAnchor="end"
                fontSize="10"
                className="fill-[var(--color-text-secondary)]"
              >
                {day}
              </text>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = cells.find((item) => item.day === dayIndex && item.hour === hour);
                const count = cell?.count || 0;
                const on = hover && hover.day === dayIndex && hover.hour === hour;
                return (
                  <rect
                    key={`${day}-${hour}`}
                    x={labelW + hour * cellW + 1}
                    y={top + dayIndex * cellH + 1}
                    width={cellW - 2}
                    height={cellH - 2}
                    rx="2"
                    fill={fill(count)}
                    stroke={on ? "#0b5f58" : "transparent"}
                    strokeWidth="1.5"
                    onMouseEnter={() => setHover({ day: dayIndex, hour })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>
                      {day} {hour}:00 — {count} chats
                    </title>
                  </rect>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Multi-series lines with end labels — Pareto-style, light theme. */
export function WorkloadChart({ workload }) {
  const [metric, setMetric] = useState("chats");
  const series = workload?.series || [];
  const points = workload?.points || [];

  const data = points.map((point) => ({
    label: point.label,
    ...(point[metric] || (metric === "chats" ? point.values : {}) || {}),
  }));
  const hasData = data.some((point) =>
    series.some((item) => Number(point[item.id]) > 0)
  );
  if (!series.length || !hasData) {
    return <ChartEmpty message="Need chats across days to compare agents." />;
  }

  const config = Object.fromEntries(
    series.map((item, i) => [
      item.id,
      { label: item.name, color: PALETTE[i % PALETTE.length] },
    ])
  );
  const nonzero = data
    .flatMap((point) => series.map((item) => Number(point[item.id]) || 0))
    .filter((n) => n > 0);
  const avgLine = nonzero.length
    ? nonzero.reduce((sum, n) => sum + n, 0) / nonzero.length
    : 0;

  const anchors = series.map((item, i) => {
    let index = data.length - 1;
    for (let p = data.length - 1; p >= 0; p -= 1) {
      if (Number(data[p][item.id]) > 0) {
        index = p;
        break;
      }
    }
    return {
      id: item.id,
      index,
      value: Number(data[index]?.[item.id]) || 0,
      i,
    };
  });

  function labelDy(id) {
    const anchor = anchors.find((item) => item.id === id);
    if (!anchor) return 0;
    const siblings = anchors.filter(
      (item) => item.index === anchor.index && item.value === anchor.value
    );
    if (siblings.length < 2) return 0;
    const rank = siblings.findIndex((item) => item.id === id);
    return (rank - (siblings.length - 1) / 2) * 16;
  }

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ left: 8, right: 96, top: 12, bottom: 8 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          {avgLine > 0 ? (
            <ReferenceLine y={avgLine} stroke="#94a3b8" strokeDasharray="4 4" />
          ) : null}
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.map((item, i) => {
            const color = PALETTE[i % PALETTE.length];
            const name =
              item.name.length > 16 ? `${item.name.slice(0, 15)}…` : item.name;
            const anchorIndex = anchors.find((row) => row.id === item.id)?.index;
            const dy = labelDy(item.id);
            return (
              <Line
                key={item.id}
                type="monotone"
                dataKey={item.id}
                stroke={color}
                strokeWidth={1.75}
                dot={{ r: 3.5, fill: color, stroke: "#fff", strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey={item.id}
                  content={({ index, x, y }) => {
                    if (index !== anchorIndex || x == null || y == null) return null;
                    return (
                      <text
                        x={x + 10}
                        y={y + 4 + dy}
                        fill={color}
                        fontSize={11}
                        fontWeight={500}
                      >
                        {name}
                      </text>
                    );
                  }}
                />
              </Line>
            );
          })}
        </LineChart>
      </ChartContainer>
      <div className="mt-3 flex justify-center">
        <div className="inline-flex rounded-full bg-[#f1f5f9] p-1">
          {WORKLOAD_METRICS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMetric(option.id)}
              className={cn(
                "rounded-full px-3.5 py-1 text-[12px] font-medium",
                metric === option.id
                  ? "bg-white text-[var(--color-text)] shadow-sm ring-1 ring-black/5"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Hexagon radar — circular grid, filled polygons, 0–100 scale. */
export function AgentRadarChart({ agents = [] }) {
  const rows = agents.filter((agent) => agent.conversations > 0).slice(0, 3);
  if (rows.length === 0) {
    return <ChartEmpty message="Health scores appear once agents have chats." />;
  }

  const maxVolume = Math.max(...rows.map((a) => a.conversations), 1);
  const maxLen = Math.max(...rows.map((a) => a.averageConversationLength || 0), 1);
  const maxMsgs = Math.max(...rows.map((a) => a.messages || 0), 1);
  const times = rows.map((a) => a.averageResponseTimeMs || 0).filter((n) => n > 0);
  const maxTime = Math.max(...times, 1);

  const config = Object.fromEntries(
    rows.map((agent, i) => [
      agent.id,
      { label: agent.name, color: PALETTE[i % PALETTE.length] },
    ])
  );

  function scores(agent) {
    return {
      Volume: Math.round((agent.conversations / maxVolume) * 100),
      Positive: Math.round(agent.positiveSentimentPercent || 0),
      Speed:
        agent.averageResponseTimeMs > 0
          ? Math.round(Math.max(((maxTime - agent.averageResponseTimeMs) / maxTime) * 100, 8))
          : 0,
      Depth: Math.round(((agent.averageConversationLength || 0) / maxLen) * 100),
      Share: Math.round(Math.min(agent.percent || 0, 100)),
      Activity: Math.round(((agent.messages || 0) / maxMsgs) * 100),
    };
  }

  const byAgent = Object.fromEntries(rows.map((agent) => [agent.id, scores(agent)]));
  const axes = ["Volume", "Positive", "Speed", "Depth", "Share", "Activity"];
  const data = axes.map((metric) => ({
    metric,
    ...Object.fromEntries(rows.map((agent) => [agent.id, byAgent[agent.id][metric]])),
  }));

  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-[280px] w-full">
      <RadarChart
        data={data}
        accessibilityLayer
        cx="50%"
        cy="50%"
        outerRadius="72%"
        margin={{ top: 8, right: 28, bottom: 8, left: 28 }}
      >
        <PolarGrid
          gridType="circle"
          stroke="#e2e8f0"
          radialLines
        />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        {rows.map((agent, i) => (
          <Radar
            key={agent.id}
            dataKey={agent.id}
            stroke={PALETTE[i % PALETTE.length]}
            fill={PALETTE[i % PALETTE.length]}
            fillOpacity={i === 0 ? 0.38 : 0.16}
            strokeWidth={2.25}
            dot={{
              r: 3.5,
              fill: PALETTE[i % PALETTE.length],
              fillOpacity: 1,
              stroke: "#fff",
              strokeWidth: 1.5,
            }}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </RadarChart>
    </ChartContainer>
  );
}

/** Donut plus named count bars. */
export function TopicMixChart({ topics = [] }) {
  const rows = [...topics]
    .filter((topic) => topic.count > 0)
    .sort((a, b) => b.count - a.count);
  if (rows.length === 0) return <ChartEmpty />;

  const data = rows.map((topic, i) => ({
    key: topic.category || topic.label,
    label: topic.label,
    count: topic.count,
    percent: topic.percent ?? 0,
    fill: PALETTE[i % PALETTE.length],
  }));
  const config = Object.fromEntries(
    data.map((topic) => [topic.key, { label: topic.label, color: topic.fill }])
  );
  const lead = data[0];

  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={config} className="aspect-auto h-[176px] w-[176px] shrink-0">
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius={50}
            outerRadius={78}
            strokeWidth={4}
            stroke="var(--color-surface)"
            paddingAngle={2}
          >
            {data.map((slice) => (
              <Cell key={slice.key} fill={slice.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {data.map((slice) => (
          <li key={slice.key}>
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--color-text)]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.fill }} />
                <span className="truncate">{slice.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
                {slice.count} · {slice.percent}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f1f5f9]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(slice.percent, 3)}%`, background: slice.fill }}
              />
            </div>
          </li>
        ))}
        {lead ? (
          <li className="pt-0.5 text-[11px] text-[var(--color-muted)]">
            {lead.label} leads at {lead.percent}%.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export function ResponseHistogram({ buckets = [] }) {
  if (!buckets.some((item) => item.count > 0)) {
    return <ChartEmpty message="No timed assistant replies in this range." />;
  }

  return (
    <ChartContainer config={latencyConfig} className="aspect-auto h-[220px] w-full">
      <BarChart
        accessibilityLayer
        data={buckets}
        layout="vertical"
        margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={58}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill={TEAL} radius={4} barSize={18} />
      </BarChart>
    </ChartContainer>
  );
}

const SENTIMENT_ORDER = [
  { key: "POSITIVE", label: "Positive", fill: GREEN },
  { key: "NEUTRAL", label: "Neutral", fill: SLATE },
  { key: "NEGATIVE", label: "Negative", fill: RED },
];

export function SentimentShareChart({ sentiment = [] }) {
  const total = sentiment.reduce((sum, item) => sum + (item.count || 0), 0);
  if (total === 0) return <ChartEmpty />;

  const rows = SENTIMENT_ORDER.map((slot) => {
    const match = sentiment.find((item) => item.sentiment === slot.key);
    return {
      ...slot,
      label: match?.label || slot.label,
      count: match?.count || 0,
      percent: match?.percent ?? 0,
    };
  });
  const present = rows.filter((row) => row.count > 0);
  const dominant = present.reduce((best, row) =>
    row.percent > best.percent ? row : best
  );

  return (
    <div className="flex min-h-[220px] flex-col justify-center gap-5">
      <div className="text-center">
        <p className="text-[36px] font-semibold tabular-nums leading-none tracking-tight text-[var(--color-text)]">
          {dominant.percent}%
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
          of chats are {dominant.label.toLowerCase()}
        </p>
      </div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-[#eef2f6]">
        {present.map((row) => (
          <div
            key={row.key}
            className="h-full min-w-1"
            style={{ width: `${row.percent}%`, background: row.fill }}
            title={`${row.label} ${row.percent}%`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className="rounded-xl bg-[#f8fafc] px-2.5 py-3 text-center"
          >
            <span
              className="mx-auto mb-1.5 block size-2 rounded-full"
              style={{ background: row.fill }}
            />
            <p className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">
              {row.percent}%
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{row.label}</p>
            <p className="text-[10px] tabular-nums text-[var(--color-muted)]">
              {row.count} chat{row.count === 1 ? "" : "s"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SentimentDonutChart({ sentiment = [] }) {
  const rows = sentiment.filter((item) => item.count > 0);
  if (rows.length === 0) return <ChartEmpty />;

  const colorMap = {
    POSITIVE: GREEN,
    NEUTRAL: SLATE,
    NEGATIVE: RED,
  };
  const config = Object.fromEntries(
    rows.map((item) => [
      item.label,
      { label: item.label, color: colorMap[item.sentiment] || SLATE },
    ])
  );
  const data = rows.map((item) => ({
    label: item.label,
    count: item.count,
    percent: item.percent ?? 0,
    fill: colorMap[item.sentiment] || SLATE,
    sentiment: item.sentiment,
  }));

  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={config} className="aspect-auto h-[168px] w-[168px] shrink-0">
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius={48}
            outerRadius={74}
            strokeWidth={4}
            stroke="var(--color-surface)"
          >
            {data.map((slice) => (
              <Cell key={slice.sentiment} fill={slice.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {data.map((slice) => (
          <li key={slice.sentiment}>
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="flex items-center gap-2 font-medium text-[var(--color-text)]">
                <span className="size-2.5 rounded-full" style={{ background: slice.fill }} />
                {slice.label}
              </span>
              <span className="tabular-nums text-[var(--color-muted)]">
                {slice.count} · {slice.percent}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f1f5f9]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(slice.percent, 2)}%`, background: slice.fill }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
