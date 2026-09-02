import { cn } from "@/lib/utils";

const SENTIMENT = {
  POSITIVE: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  NEGATIVE: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  NEUTRAL: "bg-[var(--color-bg)] text-[var(--color-text-secondary)]",
  MIXED: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
};

const SENTIMENT_DOT = {
  POSITIVE: "bg-[var(--color-success)]",
  NEGATIVE: "bg-[var(--color-danger)]",
  NEUTRAL: "bg-[var(--color-muted)]",
  MIXED: "bg-[var(--color-warning)]",
};

export function SentimentChip({ value }) {
  if (!value) {
    return (
      <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)] ring-1 ring-[var(--color-border)]">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-[var(--color-border)]",
        SENTIMENT[value] || SENTIMENT.NEUTRAL
      )}
    >
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}

export function SentimentDot({ value }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        SENTIMENT_DOT[value] || "bg-[var(--color-muted)]"
      )}
      title={value || "Unknown"}
    />
  );
}

export function CategoryChip({ value }) {
  return (
    <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)]">
      {value || "General"}
    </span>
  );
}
