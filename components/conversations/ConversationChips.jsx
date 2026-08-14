import { cn } from "@/lib/utils";

const SENTIMENT = {
  POSITIVE: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  NEGATIVE: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  NEUTRAL: "bg-slate-100 text-slate-600",
  MIXED: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
};

const SENTIMENT_DOT = {
  POSITIVE: "bg-[var(--color-success)]",
  NEGATIVE: "bg-[var(--color-danger)]",
  NEUTRAL: "bg-slate-400",
  MIXED: "bg-[var(--color-warning)]",
};

export function SentimentChip({ value }) {
  if (!value) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
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
        SENTIMENT_DOT[value] || "bg-slate-300"
      )}
      title={value || "Unknown"}
    />
  );
}

export function CategoryChip({ value }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
      {value || "General"}
    </span>
  );
}
