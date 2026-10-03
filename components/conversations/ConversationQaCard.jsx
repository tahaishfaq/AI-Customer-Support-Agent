"use client";

import { AlertTriangle, Gauge } from "lucide-react";

/** Level 3 · L2 — Auto-QA summary in the conversation details rail. */
export function ConversationQaCard({ qa }) {
  if (!qa) {
    return (
      <div>
        <dt className="text-[11px] font-medium text-[var(--color-muted)]">Answer quality</dt>
        <dd className="mt-1 text-[12px] text-[var(--color-muted)]">Not scored yet</dd>
      </div>
    );
  }

  if (qa.status && qa.status !== "OK") {
    return (
      <div>
        <dt className="text-[11px] font-medium text-[var(--color-muted)]">Answer quality</dt>
        <dd className="mt-1 text-[12px] text-[var(--color-muted)]">Unavailable ({qa.status})</dd>
      </div>
    );
  }

  const issues = Array.isArray(qa.issues) ? qa.issues : [];
  const ungrounded = Array.isArray(qa.grounded)
    ? qa.grounded.filter((row) => row && row.grounded === false)
    : [];

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-3">
      <div className="flex items-center gap-2">
        <Gauge className="size-3.5 text-[var(--color-primary)]" aria-hidden />
        <p className="text-[11px] font-medium text-[var(--color-muted)]">Answer quality</p>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-[var(--color-text)]">
        CX {qa.cxScore == null ? "—" : qa.cxScore}
        {qa.resolved != null ? (
          <span className="ml-2 text-[11px] font-normal text-[var(--color-muted)]">
            {qa.resolved ? "Resolved" : "Unresolved"}
          </span>
        ) : null}
      </p>
      {qa.tone || qa.sentiment ? (
        <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
          {[qa.tone, qa.sentiment].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {ungrounded.length ? (
        <ul className="mt-2 space-y-1">
          {ungrounded.slice(0, 3).map((row, index) => (
            <li
              key={`${row.messageId || "g"}-${index}`}
              className="flex gap-1.5 text-[11px] text-[var(--color-danger)]"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>{row.claim || "Ungrounded claim"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {issues.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-[var(--color-muted)]">
          {issues.slice(0, 3).map((issue, index) => (
            <li key={`${issue}-${index}`}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
