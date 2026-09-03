"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  listAdminCustomPlanRequests,
  updateAdminCustomPlanRequest,
} from "@/lib/api/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["ALL", "NEW", "CONTACTED", "APPROVED", "REJECTED", "CONVERTED"];

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

export function AdminCustomPlanRequests() {
  const [status, setStatus] = useState("NEW");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notesDraft, setNotesDraft] = useState({});

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminCustomPlanRequests({ status: nextStatus });
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

  async function onStatusChange(id, nextStatus) {
    setBusyId(id);
    try {
      await updateAdminCustomPlanRequest(id, {
        status: nextStatus,
        adminNotes: notesDraft[id] ?? undefined,
      });
      toast.success("Request updated");
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to update request");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="aide-page">
      <PageHeader
        title="Custom plan requests"
        description="Sales leads from the Custom pricing slot. Email notifications use Resend when wired (B0 logs in dev)."
        actions={
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/admin/billing">Billing plans</Link>
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={status === option ? "default" : "outline"}
            onClick={() => setStatus(option)}
          >
            {option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {error ? (
        <InlineAlert title="Couldn’t load requests" className="mt-4">
          {error}
        </InlineAlert>
      ) : null}

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))
        ) : rows.length === 0 ? (
          <EmptyState
            title="No requests"
            description={
              status === "NEW"
                ? "New custom plan requests will appear here."
                : "No requests match this filter."
            }
          />
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">
                      {row.contactName || row.user?.name || "Requester"}
                    </h2>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {row.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {row.contactEmail}
                    {row.companyName ? ` · ${row.companyName}` : ""}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">
                    {row.message}
                  </p>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    {formatWhen(row.createdAt)}
                    {row.user?.id ? (
                      <>
                        {" · "}
                        <Link
                          href={`/admin/users/${row.user.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          View user
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {row.status === "NEW" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => onStatusChange(row.id, "CONTACTED")}
                      >
                        Mark contacted
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.id}
                        onClick={() => onStatusChange(row.id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <Textarea
                  rows={2}
                  placeholder="Internal notes (optional)"
                  value={notesDraft[row.id] ?? row.adminNotes ?? ""}
                  onChange={(e) =>
                    setNotesDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                  }
                  className={cn(busyId === row.id && "opacity-60")}
                />
                {row.status !== "NEW" ? (
                  <div className="flex flex-wrap gap-2">
                    {["CONTACTED", "APPROVED", "CONVERTED", "REJECTED"].map(
                      (next) =>
                        next !== row.status ? (
                          <Button
                            key={next}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId === row.id}
                            onClick={() => onStatusChange(row.id, next)}
                          >
                            {next.charAt(0) + next.slice(1).toLowerCase()}
                          </Button>
                        ) : null
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
