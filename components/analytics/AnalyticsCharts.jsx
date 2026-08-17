"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function ChartCard({ title, description, children, className }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function ChartEmpty({ message = "No conversations in this range." }) {
  return (
    <div className="flex h-44 items-center justify-center rounded-lg bg-[var(--color-bg)] px-4 text-center text-[13px] text-[var(--color-muted)]">
      {message}
    </div>
  );
}

function shouldShowLabel(index, count) {
  if (count <= 8) return true;
  if (index === 0 || index === count - 1) return true;
  const step = Math.ceil(count / 6);
  return index % step === 0;
}

export function TrendChart({ points = [], emptyMessage }) {
  const gradientId = `trend-${useId().replace(/:/g, "")}`;
  const values = points.map((point) => point.conversations || 0);
  const hasData = values.some((value) => value > 0);

  if (!points.length || !hasData) {
    return <ChartEmpty message={emptyMessage} />;
  }

  const width = 720;
  const height = 188;
  const padX = 28;
  const padY = 10;
  const max = Math.max(...values, 1);
  const innerW = width - padX * 2;
  const innerH = height - padY * 2 - 16;
  const coords = points.map((point, i) => {
    const x =
      padX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = padY + innerH - (point.conversations / max) * innerH;
    return { ...point, x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${coords[0].x},${padY + innerH} ${line} ${coords[coords.length - 1].x},${padY + innerH}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-44 w-full"
      role="img"
      aria-label="Conversation trend"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b5f58" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0b5f58" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padX}
          x2={width - padX}
          y1={padY + innerH * t}
          y2={padY + innerH * t}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      ))}
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="#0b5f58"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((point, i) => (
        <g key={point.date}>
          <circle cx={point.x} cy={point.y} r="3.5" fill="#0b5f58">
            <title>
              {point.label}: {point.conversations} conversations, {point.messages}{" "}
              messages
            </title>
          </circle>
          {shouldShowLabel(i, coords.length) ? (
            <text
              x={point.x}
              y={height - 4}
              textAnchor="middle"
              className="fill-[var(--color-muted)]"
              fontSize="11"
            >
              {point.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function TopicBars({ topics = [] }) {
  const total = topics.reduce((sum, topic) => sum + (topic.count || 0), 0);
  if (total === 0) return <ChartEmpty />;

  const max = Math.max(...topics.map((topic) => topic.count || 0), 1);
  const rows = [...topics].sort(
    (a, b) => (b.count || 0) - (a.count || 0)
  );

  return (
    <div className="flex min-h-44 flex-col justify-center gap-2.5">
      {rows.map((topic) => (
        <div key={topic.category || topic.label} className="flex items-center gap-3">
          <span className="w-[5.5rem] shrink-0 truncate text-[12px] text-[var(--color-text-secondary)]">
            {topic.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)]"
              style={{ width: `${(topic.count / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-[12px] font-medium tabular-nums text-[var(--color-text)]">
            {topic.count}
            <span className="ml-1 font-normal text-[var(--color-muted)]">
              {topic.percent}%
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function SentimentDonut({ sentiment = [] }) {
  const slices = [
    { key: "POSITIVE", color: "#16a34a", fallback: "Positive" },
    { key: "NEUTRAL", color: "#94a3b8", fallback: "Neutral" },
    { key: "NEGATIVE", color: "#dc2626", fallback: "Negative" },
  ].map((slice) => {
    const match = sentiment.find((item) => item.sentiment === slice.key);
    return {
      ...slice,
      label: match?.label || slice.fallback,
      value: match?.percent || 0,
      count: match?.count || 0,
    };
  });

  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) return <ChartEmpty />;

  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const positive = slices[0].value;

  return (
    <div className="flex min-h-44 items-center gap-6 px-2">
      <svg viewBox="0 0 140 140" className="size-32 shrink-0" role="img" aria-label="Sentiment">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="16" />
        {slices.map((slice) => {
          const dash = (slice.value / 100) * c;
          const el = (
            <circle
              key={slice.key}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 70 70)"
            />
          );
          offset += dash;
          return el;
        })}
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="fill-[var(--color-text)]"
          fontSize="20"
          fontWeight="600"
        >
          {positive}%
        </text>
        <text
          x="70"
          y="84"
          textAnchor="middle"
          className="fill-[var(--color-muted)]"
          fontSize="10"
        >
          positive
        </text>
      </svg>
      <ul className="space-y-2">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 rounded-full" style={{ background: slice.color }} />
            <span className="text-[var(--color-text-secondary)]">{slice.label}</span>
            <span className="font-medium tabular-nums text-[var(--color-text)]">
              {slice.count} · {slice.value}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InsightsList({ insights = [] }) {
  if (insights.length === 0) return <ChartEmpty />;

  return (
    <ul className="flex flex-col justify-center gap-3">
      {insights.map((item) => (
        <li
          key={item.title}
          className="rounded-lg bg-[var(--color-bg)] px-3 py-2.5"
        >
          <p className="text-[13px] font-medium text-[var(--color-text)]">
            {item.title}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
            {item.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AgentShareBars({ agents = [] }) {
  const rows = agents.filter((agent) => agent.conversations > 0);
  if (rows.length === 0) return <ChartEmpty message="No chats across your agents yet." />;

  const max = Math.max(...rows.map((agent) => agent.conversations), 1);

  return (
    <div className="flex min-h-48 flex-col justify-center gap-3">
      {rows.map((agent) => (
        <div key={agent.id} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[12px] text-[var(--color-text-secondary)]">
            {agent.name}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)]"
              style={{ width: `${(agent.conversations / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-[12px] font-medium tabular-nums text-[var(--color-text)]">
            {agent.conversations}
            <span className="ml-1 font-normal text-[var(--color-muted)]">
              {agent.percent}%
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
