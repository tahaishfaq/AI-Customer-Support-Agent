"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const INITIAL_ROWS = 25;

/**
 * Large tool list (e.g. repositories) streamed in chunks. Items are untrusted tool DATA:
 * rendered as plain text, links only when https.
 */
export function ListCard({ list, themed = false, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const items = Array.isArray(list?.items) ? list.items : [];
  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, INITIAL_ROWS);
  const total = Number.isFinite(list.total) ? list.total : null;
  const loading = list.done === false;
  const muted = themed ? "var(--wc-muted)" : "var(--color-muted)";

  return (
    <div
      className={cn("w-full overflow-hidden rounded-xl border", compact ? "max-w-full" : "max-w-xl")}
      style={{
        borderColor: themed ? "var(--wc-border)" : "var(--color-border)",
        backgroundColor: themed ? "var(--wc-shell)" : "var(--color-surface)",
        color: themed ? "var(--wc-shell-fg)" : "var(--color-text)",
      }}
      aria-busy={loading || undefined}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: themed ? "var(--wc-border)" : "var(--color-border)" }}>
        <span className="text-[13px] font-semibold">
          {list.title || "Results"} · {items.length}
          {total && total > items.length ? ` of ${total}` : ""}
        </span>
        <span className="text-[11px]" style={{ color: muted }} aria-live="polite">
          {loading ? "Loading more…" : list.fetchedAll === false ? "Fetch limit reached" : "Complete"}
        </span>
      </div>
      <ul className={cn("overflow-y-auto", expanded ? "max-h-[420px]" : "max-h-[300px]")}>
        {visible.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            className="border-b px-3 py-2 last:border-b-0"
            style={{ borderColor: themed ? "var(--wc-border)" : "var(--color-border)" }}
          >
            <div className="flex items-start justify-between gap-2">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate text-[13px] font-medium hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <span className="min-w-0 truncate text-[13px] font-medium">{item.title}</span>
              )}
              {item.url ? <ExternalLink className="mt-0.5 size-3 shrink-0" style={{ color: muted }} aria-hidden /> : null}
            </div>
            {item.description ? (
              <p className="mt-0.5 line-clamp-2 text-[12px]" style={{ color: muted }}>
                {item.description}
              </p>
            ) : null}
            <p className="mt-0.5 text-[11px]" style={{ color: muted }}>
              {[
                item.visibility,
                item.language,
                Number.isFinite(item.stars) ? `★ ${item.stars}` : null,
                item.state,
                item.updated ? `Updated ${item.updated}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>
      {items.length > INITIAL_ROWS ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full border-t px-3 py-2 text-[12px] font-medium hover:bg-black/[0.03]"
          style={{ borderColor: themed ? "var(--wc-border)" : "var(--color-border)" }}
        >
          {expanded ? "Show less" : `Show all ${items.length}`}
        </button>
      ) : null}
    </div>
  );
}
