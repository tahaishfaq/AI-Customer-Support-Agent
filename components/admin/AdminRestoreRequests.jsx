"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  decideAdminRestoreRequest,
  listAdminRestoreRequests,
} from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function statusLabel(status) {
  if (status === "APPROVED") return "Restored";
  if (status === "REJECTED") return "Rejected";
  return "Pending";
}

export function AdminRestoreRequests() {
  const [status, setStatus] = useState("PENDING");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminRestoreRequests({ status: nextStatus });
      setRows(data);
    } catch (err) {
      setError(err.message || "Unable to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(status);
  }, [status]);

  async function onDecide(id, decision) {
    setBusyId(id);
    try {
      await decideAdminRestoreRequest(id, decision);
      toast.success(decision === "REJECT" ? "Request rejected" : "User restored");
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to update request");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="hapy-page">
      <PageHeader
        title="Access requests"
        description="Restore a suspended user, or reject the request. They stay suspended until you restore them."
      />

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { id: "PENDING", label: "Pending" },
          { id: "APPROVED", label: "Restored" },
          { id: "REJECTED", label: "Rejected" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStatus(item.id)}
            className={
              status === item.id
                ? "rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[12px] font-medium text-white"
                : "rounded-md bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)]"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 bg-[var(--color-border)]" />
            <Skeleton className="h-16 bg-[var(--color-border)]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-[var(--color-muted)]">
            No {statusLabel(status).toLowerCase()} requests.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/users/${row.user?.id}`}
                      className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {row.user?.name || "User"}
                    </Link>
                    <p className="text-[12px] text-[var(--color-muted)]">
                      {row.user?.email}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--color-text)]">
                      {row.message}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <p className="text-[11px] text-[var(--color-muted)]">
                      {statusLabel(row.status)} · {formatWhen(row.createdAt)}
                    </p>
                    {row.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === row.id}
                          onClick={() => onDecide(row.id, "APPROVE")}
                        >
                          {busyId === row.id ? "…" : "Restore"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busyId === row.id}
                          onClick={() => onDecide(row.id, "REJECT")}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
