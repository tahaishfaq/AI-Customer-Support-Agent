"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { exportAdminAudit, listAdminAudit } from "@/lib/api/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ACTION_FILTERS = [
  { id: "", label: "All" },
  { id: "USER_SUSPEND", label: "Suspend" },
  { id: "USER_SUSPEND_FAILED", label: "Suspend fail" },
  { id: "USER_RESTORE", label: "Restore" },
  { id: "USER_EXPORT", label: "Export" },
  { id: "USER_EXPORT_FAILED", label: "Export fail" },
  { id: "USER_DELETE", label: "Delete" },
  { id: "CONVERSATION_OPEN", label: "Transcript" },
  { id: "AGENT_OPEN", label: "Agent" },
  { id: "SETTINGS_UPDATE", label: "Settings" },
];

const EXPORT_OPTIONS = [
  {
    id: "json",
    label: "JSON (full)",
    hint: "All fields + metadata",
  },
  {
    id: "csv",
    label: "CSV (spreadsheet)",
    hint: "Excel / Sheets",
  },
  {
    id: "ndjson",
    label: "NDJSON (logs)",
    hint: "One event per line",
  },
  {
    id: "summary",
    label: "Summary CSV",
    hint: "Time, action, admin, target",
  },
];

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function parsePage(raw) {
  const n = Number.parseInt(raw || "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function pageWindow(current, total) {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const nums = [...keep]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out = [];
  nums.forEach((n) => {
    if (out.length) {
      const prev = out[out.length - 1];
      if (typeof prev === "number" && n - prev > 1) out.push("…");
    }
    out.push(n);
  });
  return out;
}

function actionLabel(action) {
  return String(action || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function targetHref(event) {
  if (event.targetType === "USER" && event.targetId) {
    return `/admin/users/${event.targetId}`;
  }
  return null;
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadFile(filename, mime, body) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replaceAll(":", "-");
}

function toCsv(events, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const lines = events.map((event) =>
    columns.map((c) => csvEscape(c.value(event))).join(",")
  );
  return [header, ...lines].join("\n");
}

function flattenEvent(event) {
  return {
    id: event.id,
    createdAt: event.createdAt,
    action: event.action,
    adminEmail: event.admin?.email || "",
    adminName: event.admin?.name || "",
    targetType: event.targetType || "",
    targetId: event.targetId || "",
    ip: event.ip || "",
    metadata: event.metadata ? JSON.stringify(event.metadata) : "",
  };
}

const CSV_COLUMNS = [
  { label: "id", value: (e) => e.id },
  { label: "createdAt", value: (e) => e.createdAt },
  { label: "action", value: (e) => e.action },
  { label: "adminEmail", value: (e) => e.adminEmail },
  { label: "adminName", value: (e) => e.adminName },
  { label: "targetType", value: (e) => e.targetType },
  { label: "targetId", value: (e) => e.targetId },
  { label: "ip", value: (e) => e.ip },
  { label: "metadata", value: (e) => e.metadata },
];

const SUMMARY_COLUMNS = [
  { label: "createdAt", value: (e) => e.createdAt },
  { label: "action", value: (e) => e.action },
  { label: "adminEmail", value: (e) => e.adminEmail },
  { label: "targetType", value: (e) => e.targetType },
  { label: "targetId", value: (e) => e.targetId },
];

const fieldClass =
  "h-10 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20";

export function AdminAuditLog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = searchParams.get("action") || "";
  const q = searchParams.get("q") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const page = parsePage(searchParams.get("page"));

  const [search, setSearch] = useState(q);
  const [data, setData] = useState({
    events: [],
    page: 1,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportTruncated, setExportTruncated] = useState(null);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const replaceParams = useCallback(
    (patch) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (!value) params.delete(key);
        else params.set(key, String(value));
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listAdminAudit({ action, q, from, to, page });
      setData(result);
      if (result.totalPages > 0 && page > result.totalPages) {
        replaceParams({
          page: result.totalPages === 1 ? "" : String(result.totalPages),
        });
      }
    } catch (err) {
      setError(err.message || "Unable to load audit log");
    } finally {
      setLoading(false);
    }
  }, [action, q, from, to, page, replaceParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search === q) return;
      replaceParams({ q: search.trim(), page: "" });
    }, 300);
    return () => clearTimeout(handle);
  }, [search, q, replaceParams]);

  async function onExport(format) {
    setExporting(true);
    try {
      const payload = await exportAdminAudit({ action, q, from, to });
      const events = payload.events || [];
      const flat = events.map(flattenEvent);
      const base = `hapy-audit-${stamp()}`;

      if (format === "json") {
        downloadFile(
          `${base}.json`,
          "application/json",
          JSON.stringify(payload, null, 2)
        );
      } else if (format === "ndjson") {
        downloadFile(
          `${base}.ndjson`,
          "application/x-ndjson",
          events.map((event) => JSON.stringify(event)).join("\n")
        );
      } else if (format === "summary") {
        downloadFile(`${base}-summary.csv`, "text/csv", toCsv(flat, SUMMARY_COLUMNS));
      } else {
        downloadFile(`${base}.csv`, "text/csv", toCsv(flat, CSV_COLUMNS));
      }

      toast.success(
        payload.truncated
          ? `Exported first ${events.length} of ${payload.total} events`
          : `Exported ${events.length} events`
      );
      if (payload.truncated) {
        setExportTruncated({
          exported: events.length,
          total: payload.total,
        });
      } else {
        setExportTruncated(null);
      }
    } catch (err) {
      toast.error(err.message || "Unable to export");
    } finally {
      setExporting(false);
    }
  }

  const pageSize = data.pageSize || 20;
  const totalPages = Math.max(1, data.totalPages || 1);
  const rangeStart = data.total ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, data.total || 0);
  const pageItems = pageWindow(page, totalPages);

  return (
    <main className="hapy-page">
      <PageHeader
        title="Audit"
        description="Immutable log of inspect, suspend, export, and delete. Filter by time, then download."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={exporting}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2.5 text-[0.8rem] font-medium text-[var(--color-text)] outline-none hover:bg-[var(--color-bg)] disabled:opacity-50"
            >
              <Download className="size-3.5" />
              {exporting ? "Exporting…" : "Export"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>Uses current filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {EXPORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  disabled={exporting}
                  onClick={() => onExport(option.id)}
                >
                  <span>
                    <span className="block">{option.label}</span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {option.hint}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {exportTruncated ? (
        <InlineAlert className="mt-4">
          Audit export was truncated: downloaded {exportTruncated.exported} of{" "}
          {exportTruncated.total} matching events (cap 10,000). Narrow filters
          by date or action and export again for the rest.
        </InlineAlert>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, target id, or IP"
              className={`${fieldClass} w-full pl-9`}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-medium text-[var(--color-muted)]">
              From
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => replaceParams({ from: e.target.value, page: "" })}
                className={`${fieldClass} mt-1 block`}
              />
            </label>
            <label className="text-[11px] font-medium text-[var(--color-muted)]">
              To
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => replaceParams({ to: e.target.value, page: "" })}
                className={`${fieldClass} mt-1 block`}
              />
            </label>
            {from || to ? (
              <button
                type="button"
                onClick={() => replaceParams({ from: "", to: "", page: "" })}
                className="mb-1 text-[12px] font-medium text-[var(--color-primary)] hover:underline"
              >
                Clear dates
              </button>
            ) : null}
          </div>
        </div>
        <div
          role="group"
          aria-label="Action"
          className="inline-flex flex-wrap rounded-lg border border-[var(--color-border)] bg-white p-0.5"
        >
          {ACTION_FILTERS.map((item) => (
            <button
              key={item.id || "all"}
              type="button"
              onClick={() => replaceParams({ action: item.id, page: "" })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[12px] font-medium",
                action === item.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-2">
          <Skeleton className="h-14 w-full bg-[var(--color-border)]" />
          <Skeleton className="h-14 w-full bg-[var(--color-border)]" />
          <Skeleton className="h-14 w-full bg-[var(--color-border)]" />
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-[var(--color-danger)]">{error}</p>
      ) : data.events.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--color-border)] bg-white px-5 py-12 text-center text-sm text-[var(--color-muted)]">
          No audit events match these filters.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
          <ul>
            {data.events.map((event) => {
              const href = targetHref(event);
              return (
                <li
                  key={event.id}
                  className="border-b border-[var(--color-border)] px-4 py-3.5 last:border-b-0"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--color-text)]">
                        {actionLabel(event.action)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                        {event.admin?.email || "Admin"}
                        {event.targetType ? ` · ${event.targetType}` : ""}
                        {event.ip ? ` · ${event.ip}` : ""}
                      </p>
                      {event.targetId ? (
                        href ? (
                          <Link
                            href={href}
                            className="mt-1 inline-block font-mono text-[11px] text-[var(--color-primary)] hover:underline"
                          >
                            {event.targetId}
                          </Link>
                        ) : (
                          <p className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
                            {event.targetId}
                          </p>
                        )
                      ) : null}
                    </div>
                    <p className="shrink-0 text-[11px] text-[var(--color-muted)]">
                      {formatWhen(event.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[var(--color-muted)]">
              Showing {rangeStart}–{rangeEnd} of {data.total}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() =>
                  replaceParams({ page: page > 2 ? String(page - 1) : "" })
                }
                className="h-8 rounded-lg bg-white px-3 text-[12px] font-medium ring-1 ring-[var(--color-border)] disabled:opacity-40"
              >
                Previous
              </button>
              {pageItems.map((item, index) =>
                item === "…" ? (
                  <span
                    key={`gap-${index}`}
                    className="px-1 text-[12px] text-[var(--color-muted)]"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      replaceParams({ page: item === 1 ? "" : String(item) })
                    }
                    className={cn(
                      "h-8 min-w-8 rounded-lg px-2 text-[12px] font-medium ring-1",
                      item === page
                        ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]"
                        : "bg-white text-[var(--color-text)] ring-[var(--color-border)]"
                    )}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => replaceParams({ page: String(page + 1) })}
                className="h-8 rounded-lg bg-white px-3 text-[12px] font-medium ring-1 ring-[var(--color-border)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}