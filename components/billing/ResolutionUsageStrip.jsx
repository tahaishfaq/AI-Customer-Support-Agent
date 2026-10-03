"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

function formatMoney(minor, currency) {
  const amount = Number(minor) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency || "USD"}`;
  }
}

/** Level 3 · L5 — read-only resolution charge usage when plan opts in. */
export function ResolutionUsageStrip() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/billing/resolution-usage")
      .then((row) => {
        if (!cancelled) setData(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unable to load resolution usage");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error || !data) return null;
  if (!data.enabled) return null;

  const {
    chargedCount = 0,
    reversedCount = 0,
    maxPerMonth = 0,
    unitPriceMinor = 0,
    currency = "USD",
    estimatedMinor = 0,
  } = data;

  return (
    <section className="aide-card px-4 py-4" aria-labelledby="resolution-usage-heading">
      <h2
        id="resolution-usage-heading"
        className="text-sm font-semibold text-foreground"
      >
        Resolution usage
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Per-resolution pricing on your plan (ledger only — not a separate invoice
        yet).
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Charged this month</dt>
          <dd className="font-medium">
            {chargedCount}
            {maxPerMonth > 0 ? ` / ${maxPerMonth}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Unit price</dt>
          <dd className="font-medium">
            {formatMoney(unitPriceMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estimated charges</dt>
          <dd className="font-medium">
            {formatMoney(estimatedMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reversed (credits)</dt>
          <dd className="font-medium">{reversedCount}</dd>
        </div>
      </dl>
    </section>
  );
}
