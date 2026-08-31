"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search, Users } from "lucide-react";
import { listAdminUsers } from "@/lib/api/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "SUSPENDED", label: "Suspended" },
];

const ROLE_FILTERS = [
  { id: "all", label: "All" },
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
    <Badge
      variant={role === "ADMIN" ? "default" : "secondary"}
      className="rounded-full"
    >
      {role === "ADMIN" ? "Admin" : "User"}
    </Badge>
  );
}

function StatusBadge({ status }) {
  const suspended = status === "SUSPENDED";
  return (
    <Badge
      variant={suspended ? "destructive" : "outline"}
      className={cn(
        "rounded-full",
        !suspended && "border-emerald-500/40 text-emerald-700"
      )}
    >
      {suspended ? "Suspended" : "Active"}
    </Badge>
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
  const [reloadKey, setReloadKey] = useState(0);

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
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
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
        const result = await listAdminUsers({
          q,
          status,
          role,
          page,
          pageSize: 20,
        });
        if (cancelled) return;
        setUsers(result.users);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        if (result.totalPages > 0 && page > result.totalPages) {
          replaceQuery({
            page: result.totalPages === 1 ? null : result.totalPages,
          });
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
  }, [q, status, role, page, replaceQuery, reloadKey]);

  const rangeStart = total === 0 ? 0 : (page - 1) * 20 + 1;
  const rangeEnd = Math.min(page * 20, total);
  const hasFilters = Boolean(q || status || role);

  return (
    <main className="aide-page">
      <PageHeader
        title="Users"
        description="Every customer account. Open one to inspect workspaces."
      />

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <InputGroup className="w-full lg:max-w-sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search name or email"
          />
        </InputGroup>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Status
            </span>
            <ToggleGroup
              value={[status || "all"]}
              onValueChange={(next) => {
                const id = next?.[0];
                if (!id) return;
                replaceQuery({
                  status: id === "all" ? null : id,
                  page: null,
                });
              }}
              variant="outline"
              size="sm"
              spacing={0}
            >
              {STATUS_FILTERS.map((item) => (
                <ToggleGroupItem key={item.id} value={item.id}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Role
            </span>
            <ToggleGroup
              value={[role || "all"]}
              onValueChange={(next) => {
                const id = next?.[0];
                if (!id) return;
                replaceQuery({
                  role: id === "all" ? null : id,
                  page: null,
                });
              }}
              variant="outline"
              size="sm"
              spacing={0}
            >
              {ROLE_FILTERS.map((item) => (
                <ToggleGroupItem key={item.id} value={item.id}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQInput("");
                replaceQuery({
                  q: null,
                  status: null,
                  role: null,
                  page: null,
                });
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <InlineAlert
          className="mt-4"
          onRetry={() => setReloadKey((n) => n + 1)}
        >
          {error}
        </InlineAlert>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            className="border-0 shadow-none"
            title={hasFilters ? "No users match" : "No users yet"}
            description={
              hasFilters
                ? "Try clearing filters or searching a different name/email."
                : "Customer accounts will appear here after signup."
            }
            action={
              hasFilters ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setQInput("");
                    replaceQuery({
                      q: null,
                      status: null,
                      role: null,
                      page: null,
                    });
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden lg:table-cell">Role</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Workspaces
                </TableHead>
                <TableHead className="hidden text-right lg:table-cell">
                  Last login
                </TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="cursor-pointer">
                  <TableCell className="whitespace-normal">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {initials(user.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:hidden">
                          <RoleBadge role={user.role} />
                          <StatusBadge status={user.status} />
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {user.workspaceCount}{" "}
                    {user.workspaceCount === 1 ? "workspace" : "workspaces"}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                    {formatLastLogin(user.lastLoginAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={<Link href={`/admin/users/${user.id}`} />}
                      aria-label={`Open ${user.name}`}
                    >
                      <ChevronRight />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && total > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  replaceQuery({ page: page <= 2 ? null : page - 1 })
                }
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => replaceQuery({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
