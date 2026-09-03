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
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { selectionChipClass } from "@/lib/ui/selection-chip";

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

const OPEN_ALL_CAP = 10;

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

  function openAllPendingUsers() {
    const targets = rows.filter((row) => row.user?.id).slice(0, OPEN_ALL_CAP);
    if (targets.length === 0) {
      toast.message("No users to open");
      return;
    }
    for (const row of targets) {
      window.open(`/admin/users/${row.user.id}`, "_blank", "noopener,noreferrer");
    }
    if (rows.length > OPEN_ALL_CAP) {
      toast.message(`Opened first ${OPEN_ALL_CAP} of ${rows.length}`);
    }
  }

  return (
    <main className="aide-page">
      <PageHeader
        title="Access requests"
        description="Restore a suspended user, or reject the request. They stay suspended until you restore them."
        actions={
          status === "PENDING" && rows.length > 0 && !loading ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openAllPendingUsers}
            >
              Open all users
            </Button>
          ) : null
        }
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
            className={selectionChipClass(
              status === item.id,
              "rounded-md px-3 py-1.5 text-[12px] font-medium"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <InlineAlert className="mt-4" onRetry={() => load()}>
          {error}
        </InlineAlert>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 bg-muted" />
            <Skeleton className="h-16 bg-muted" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            className="border-0 shadow-none"
            title={`No ${statusLabel(status).toLowerCase()} requests`}
            description="When a suspended user asks for access again, it shows up here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/users/${row.user?.id}`}
                      className="text-[13px] font-medium text-primary hover:underline"
                    >
                      {row.user?.name || "User"}
                    </Link>
                    <p className="text-[12px] text-muted-foreground">
                      {row.user?.email}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] text-foreground">
                      {row.message}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <p className="text-[11px] text-muted-foreground">
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
