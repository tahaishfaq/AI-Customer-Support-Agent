"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { listAdminUsers } from "@/lib/api/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "ACTIVE", label: "Active", dot: "bg-[var(--color-success)]" },
  { id: "SUSPENDED", label: "Suspended", dot: "bg-[var(--color-danger)]" },
];

const ROLE_FILTERS = [
  { id: "", label: "All" },
  { id: "USER", label: "User" },
  { id: "ADMIN", label: "Admin" },
];

function formatLastLogin(value) {
  if (!value) return "No login yet";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "No login yet";
  }
}

function parsePage(raw) {
  const n = Number.parseInt(raw || "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function initials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function RoleBadge({ role }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        role === "ADMIN"
          ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          : "bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
      )}
    >
      {role === "ADMIN" ? "Admin" : "User"}
    </span>
  );
}

function StatusBadge({ status }) {
  const suspended = status === "SUSPENDED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        suspended
          ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
          : "bg-[var(--color-success)]/10 text-[var(--color-success)]"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          suspended ? "bg-[var(--color-danger)]" : "bg-[var(--color-success)]"
        )}
      />
      {suspended ? "Suspended" : "Active"}
    </span>
  );
}

function FilterPills({ items, value, onChange, label }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex flex-wrap rounded-lg border border-[var(--color-border)] bg-white p-0.5"
      >
        {items.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id || `${label}-all`}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
              )}
            >
              {item.dot ? (
                <span
                  className={cn("size-1.5 rounded-full", item.dot)}
                  aria-hidden
                />
              ) : null}
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AdminUsersDirectory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const role = searchParams.get("role") || "";
  const page = parsePage(searchParams.get("page"));

  const [qInput, setQInput] = useState(q);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQInput(q);
  }, [q]);

  const replaceQuery = useCallback(
    (patch) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === "" || value == null) params.delete(key);
        else params.set(key, String(value));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = qInput.trim();
      if (next === q) return;
      replaceQuery({ q: next, page: null });
    }, 250);
    return () => clearTimeout(handle);
  }, [qInput, q, replaceQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await listAdminUsers({ q, status, role, page, pageSize: 20 });
        if (cancelled) return;
        setUsers(result.users);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        if (result.totalPages > 0 && page > result.totalPages) {
          replaceQuery({ page: result.totalPages === 1 ? null : result.totalPages });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, status, role, page, replaceQuery]);

  const rangeStart = total === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeEnd = Math.min(page * 20, total);
  const hasFilters = Boolean(q || status || role);

  return (
    <main className="hapy-page">
      <PageHeader
        title="Users"
        description="Every customer account. Open one to inspect workspaces."
      />

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search name or email"
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <FilterPills
            label="Status"
            items={STATUS_FILTERS}
            value={status}
            onChange={(id) => replaceQuery({ status: id, page: null })}
          />
          <FilterPills
            label="Role"
            items={ROLE_FILTERS}
            value={role}
            onChange={(id) => replaceQuery({ role: id, page: null })}
          />
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQInput("");
                replaceQuery({ q: null, status: null, role: null, page: null });
              }}
              className="h-8 rounded-lg px-3 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14 bg-[var(--color-border)]" />
            <Skeleton className="h-14 bg-[var(--color-border)]" />
            <Skeleton className="h-14 bg-[var(--color-border)]" />
          </div>
        ) : users.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-[var(--color-muted)]">
            No users match this search.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {users.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/admin/users/${user.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-bg)]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[11px] font-semibold text-[var(--color-primary)]">
                    {initials(user.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-text)]">
                      {user.name}
                    </span>
                    <span className="block truncate text-[13px] text-[var(--color-muted)]">
                      {user.email}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:hidden">
                      <RoleBadge role={user.role} />
                      <StatusBadge status={user.status} />
                      <span className="text-[12px] text-[var(--color-muted)]">
                        {user.workspaceCount} ws · {formatLastLogin(user.lastLoginAt)}
                      </span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-3 lg:flex">
                    <RoleBadge role={user.role} />
                    <StatusBadge status={user.status} />
                    <span className="w-[6.5rem] text-[13px] text-[var(--color-text-secondary)]">
                      {user.workspaceCount}{" "}
                      {user.workspaceCount === 1 ? "workspace" : "workspaces"}
                    </span>
                    <span className="w-[8.75rem] text-right">
                      <span className="block text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                        Last login
                      </span>
                      <span className="block text-[13px] text-[var(--color-text-secondary)]">
                        {formatLastLogin(user.lastLoginAt)}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[var(--color-muted)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!loading && total > 0 ? (
          <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[var(--color-muted)]">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => replaceQuery({ page: page <= 2 ? null : page - 1 })}
                className="h-8 rounded-lg bg-white px-3 text-[12px] font-medium ring-1 ring-[var(--color-border)] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[12px] text-[var(--color-text-secondary)]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => replaceQuery({ page: page + 1 })}
                className="h-8 rounded-lg bg-white px-3 text-[12px] font-medium ring-1 ring-[var(--color-border)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
