const TREND = {
  "7d": [
    { label: "Mon", value: 12 },
    { label: "Tue", value: 18 },
    { label: "Wed", value: 9 },
    { label: "Thu", value: 22 },
    { label: "Fri", value: 16 },
    { label: "Sat", value: 7 },
    { label: "Sun", value: 11 },
  ],
  "30d": [
    { label: "W1", value: 42 },
    { label: "W2", value: 58 },
    { label: "W3", value: 36 },
    { label: "W4", value: 71 },
  ],
  all: [
    { label: "Jan", value: 80 },
    { label: "Feb", value: 95 },
    { label: "Mar", value: 110 },
    { label: "Apr", value: 88 },
    { label: "May", value: 132 },
    { label: "Jun", value: 120 },
  ],
};

const TOPICS = {
  "7d": [
    { label: "Billing", value: 34 },
    { label: "Account", value: 22 },
    { label: "Product", value: 18 },
    { label: "Shipping", value: 14 },
    { label: "Other", value: 12 },
  ],
  "30d": [
    { label: "Billing", value: 40 },
    { label: "Account", value: 21 },
    { label: "Product", value: 16 },
    { label: "Shipping", value: 13 },
    { label: "Other", value: 10 },
  ],
  all: [
    { label: "Billing", value: 31 },
    { label: "Account", value: 24 },
    { label: "Product", value: 20 },
    { label: "Shipping", value: 15 },
    { label: "Other", value: 10 },
  ],
};

const SENTIMENT = {
  "7d": { positive: 62, neutral: 27, negative: 11 },
  "30d": { positive: 58, neutral: 29, negative: 13 },
  all: { positive: 64, neutral: 24, negative: 12 },
};

const INSIGHTS = [
  {
    title: "Billing is the top topic",
    detail: "About 1 in 3 conversations mention invoices or plans.",
  },
  {
    title: "Most chats land on weekdays",
    detail: "Thursday is the busiest day in this sample week.",
  },
  {
    title: "Sentiment is mostly positive",
    detail: "Negative chats stay under 15% in the sample set.",
  },
];

function TrendChart({ points }) {
  const width = 560;
  const height = 180;
  const padX = 28;
  const padY = 18;
  const max = Math.max(...points.map((p) => p.value), 1);
  const innerW = width - padX * 2;
  const innerH = height - padY * 2 - 18;
  const coords = points.map((p, i) => {
    const x = padX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = padY + innerH - (p.value / max) * innerH;
    return { ...p, x, y };
  });
  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${coords[0].x},${padY + innerH} ${line} ${coords[coords.length - 1].x},${padY + innerH}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Demo conversation trend">
      <defs>
        <linearGradient id="hapyTrendFill" x1="0" y1="0" x2="0" y2="1">
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
      <polygon points={area} fill="url(#hapyTrendFill)" />
      <polyline
        points={line}
        fill="none"
        stroke="#0b5f58"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r="3.5" fill="#0b5f58" />
      ))}
      {coords.map((p) => (
        <text
          key={`${p.label}-label`}
          x={p.x}
          y={height - 4}
          textAnchor="middle"
          className="fill-[var(--color-muted)]"
          fontSize="11"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

function TopicBars({ topics }) {
  const max = Math.max(...topics.map((t) => t.value), 1);
  return (
    <div className="flex h-48 flex-col justify-center gap-2.5">
      {topics.map((topic) => (
        <div key={topic.label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 truncate text-[12px] text-[var(--color-text-secondary)]">
            {topic.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)]"
              style={{ width: `${(topic.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] font-medium text-[var(--color-text)]">
            {topic.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

function SentimentDonut({ sentiment }) {
  const slices = [
    { key: "positive", value: sentiment.positive, color: "#16a34a", label: "Positive" },
    { key: "neutral", value: sentiment.neutral, color: "#94a3b8", label: "Neutral" },
    { key: "negative", value: sentiment.negative, color: "#dc2626", label: "Negative" },
  ];
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex h-48 items-center gap-6 px-2">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0" role="img" aria-label="Demo sentiment">
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
          {sentiment.positive}%
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
            <span className="font-medium text-[var(--color-text)]">{slice.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DemoTrendChart({ range }) {
  return <TrendChart points={TREND[range] || TREND["7d"]} />;
}

export function DemoTopicChart({ range }) {
  return <TopicBars topics={TOPICS[range] || TOPICS["7d"]} />;
}

export function DemoSentimentChart({ range }) {
  return <SentimentDonut sentiment={SENTIMENT[range] || SENTIMENT["7d"]} />;
}

export function DemoInsights() {
  return (
    <ul className="flex h-48 flex-col justify-center gap-3">
      {INSIGHTS.map((item) => (
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
