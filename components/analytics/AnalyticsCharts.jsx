"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { SoftFade } from "@/components/motion/soft-motion";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  aside,
  children,
  className,
  dense = false,
}) {
  return (
    <SoftFade
      as="section"
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
        "ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
        className
      )}
    >
      <div
        className={cn(
          "shrink-0 border-b border-border/60 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent",
          dense ? "px-3 py-2.5" : "px-4 py-3"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2
              className={cn(
                "font-semibold tracking-tight text-foreground",
                dense ? "text-[13px]" : "text-sm"
              )}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {aside ? (
            <div className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {aside}
            </div>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          dense ? "p-3" : "p-4 pt-3"
        )}
      >
        {children}
      </div>
    </SoftFade>
  );
}

export function ChartEmpty({
  message = "No conversations in this range.",
  className,
}) {
  return (
    <div
      className={cn(
        "flex h-44 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 text-center text-sm text-muted-foreground",
        className
      )}
    >
      {message}
    </div>
  );
}

const trendConfig = {
  conversations: { label: "Chats", color: "var(--chart-1)" },
};

export function TrendChart({ points = [], emptyMessage }) {
  const gradientId = `trend-${useId().replace(/:/g, "")}`;
  const values = points.map((point) => point.conversations || 0);
  const hasData = values.some((value) => value > 0);

  if (!points.length || !hasData) {
    return <ChartEmpty message={emptyMessage} />;
  }

  const data = points.map((point) => ({
    label: point.label,
    conversations: point.conversations || 0,
    messages: point.messages || 0,
  }));

  return (
    <ChartContainer config={trendConfig} className="aspect-auto h-44 w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="conversations"
          stroke="var(--chart-1)"
          strokeWidth={2.25}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function TopicBars({ topics = [] }) {
  const total = topics.reduce((sum, topic) => sum + (topic.count || 0), 0);
  if (total === 0) return <ChartEmpty />;

  const max = Math.max(...topics.map((topic) => topic.count || 0), 1);
  const rows = [...topics].sort((a, b) => (b.count || 0) - (a.count || 0));

  return (
    <div className="flex min-h-44 flex-col justify-center gap-2.5">
      {rows.map((topic) => (
        <div
          key={topic.category || topic.label}
          className="flex items-center gap-3"
        >
          <span className="w-[5.5rem] shrink-0 truncate text-[12px] text-muted-foreground">
            {topic.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${(topic.count / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-[12px] font-medium tabular-nums text-foreground">
            {topic.count}
            <span className="ml-1 font-normal text-muted-foreground">
              {topic.percent}%
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

const sentimentConfig = {
  POSITIVE: { label: "Positive", color: "var(--color-success)" },
  NEUTRAL: { label: "Neutral", color: "var(--muted-foreground)" },
  NEGATIVE: { label: "Negative", color: "var(--color-danger)" },
};

export function SentimentDonut({ sentiment = [] }) {
  const slices = [
    { key: "POSITIVE", fallback: "Positive" },
    { key: "NEUTRAL", fallback: "Neutral" },
    { key: "NEGATIVE", fallback: "Negative" },
  ].map((slice) => {
    const match = sentiment.find((item) => item.sentiment === slice.key);
    return {
      key: slice.key,
      label: match?.label || slice.fallback,
      value: match?.count || 0,
      percent: match?.percent || 0,
      fill: sentimentConfig[slice.key].color,
    };
  });

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return <ChartEmpty />;

  const positive = slices[0].percent;

  return (
    <div className="flex min-h-44 items-center gap-5 px-1">
      <div className="relative size-36 shrink-0">
        <ChartContainer
          config={sentimentConfig}
          className="aspect-square size-36"
          initialDimension={{ width: 144, height: 144 }}
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="label" hideLabel />}
            />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={48}
              outerRadius={64}
              strokeWidth={2}
              stroke="var(--card)"
              paddingAngle={2}
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {positive}%
          </span>
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            positive
          </span>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-[13px]">
            <span
              className="size-2.5 rounded-full"
              style={{ background: slice.fill }}
            />
            <span className="text-muted-foreground">{slice.label}</span>
            <span className="font-medium tabular-nums text-foreground">
              {slice.value} · {slice.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InsightsList({
  insights = [],
  emptyMessage = "No insights for this range yet.",
}) {
  if (insights.length === 0) {
    return <ChartEmpty message={emptyMessage} className="min-h-[120px] h-auto" />;
  }
  return (
    <ul className="flex flex-col justify-center gap-3">
      {insights.map((item) => (
        <li
          key={item.title}
          className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5"
        >
          <p className="text-[13px] font-medium text-foreground">{item.title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{item.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function AgentShareBars({ agents = [] }) {
  const rows = agents.filter((agent) => agent.conversations > 0);
  if (rows.length === 0) {
    return <ChartEmpty message="No chats across your agents yet." />;
  }

  const max = Math.max(...rows.map((agent) => agent.conversations), 1);

  return (
    <div className="flex min-h-48 flex-col justify-center gap-3">
      {rows.map((agent) => (
        <div key={agent.id} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[12px] text-muted-foreground">
            {agent.name}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${(agent.conversations / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-[12px] font-medium tabular-nums text-foreground">
            {agent.conversations}
            <span className="ml-1 font-normal text-muted-foreground">
              {agent.percent}%
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
