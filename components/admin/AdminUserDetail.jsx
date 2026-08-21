"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  decideAdminRestoreRequest,
  deleteAdminUser,
  exportAdminUser,
  getAdminUser,
  restoreAdminUser,
  suspendAdminUser,
} from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function AdminUserDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminUser(id);
      setUser(data);
    } catch (err) {
      setError(err.message || "Unable to load user");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function onSuspend() {
    setBusy(true);
    try {
      const updated = await suspendAdminUser(id);
      setUser((prev) => ({ ...prev, ...updated }));
      setConfirmOpen(false);
      toast.success("User suspended");
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to suspend");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    setBusy(true);
    try {
      const updated = await restoreAdminUser(id);
      setUser((prev) => ({ ...prev, ...updated }));
      toast.success("User restored");
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to restore");
    } finally {
      setBusy(false);
    }
  }

  async function onRejectRequest() {
    if (!user.restoreRequest?.id) return;
    setBusy(true);
    try {
      await decideAdminRestoreRequest(user.restoreRequest.id, "REJECT");
      toast.success("Request rejected");
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to reject request");
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setExporting(true);
    try {
      const payload = await exportAdminUser(id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hapy-user-${payload.user.email || id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err.message || "Unable to export");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteAdminUser(id, deleteEmail);
      toast.success("User deleted");
      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Unable to delete");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="hapy-page">
        <Skeleton className="h-10 w-64 bg-[var(--color-border)]" />
        <Skeleton className="mt-6 h-40 w-full bg-[var(--color-border)]" />
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="hapy-page">
        <p className="text-sm text-[var(--color-danger)]">
          {error || "User not found"}
        </p>
        <Link
          href="/admin/users"
          className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] underline"
        >
          Back to users
        </Link>
      </main>
    );
  }

  const canSuspend = user.role !== "ADMIN" && user.status === "ACTIVE";
  const canRestore = user.role !== "ADMIN" && user.status === "SUSPENDED";
  const workspaces = user.workspaces || [];

  return (
    <main className="hapy-page">
      <PageHeader
        title={user.name}
        description={user.email}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={onExport}
            >
              {exporting ? "Exporting…" : "Export"}
            </Button>
            {user.role !== "ADMIN" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteEmail("");
                  setDeleteOpen(true);
                }}
              >
                Delete
              </Button>
            ) : null}
            {canSuspend ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
              >
                Suspend
              </Button>
            ) : null}
            {canRestore ? (
              <>
                <Button type="button" size="sm" disabled={busy} onClick={onRestore}>
                  {busy ? "Restoring…" : "Restore"}
                </Button>
                {user.restoreRequest?.status === "PENDING" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={onRejectRequest}
                  >
                    Reject request
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Role" value={user.role} />
        <Info
          label="Status"
          value={user.status === "SUSPENDED" ? "Suspended" : "Active"}
        />
        <Info label="Created" value={formatWhen(user.createdAt)} />
        <Info label="Last login" value={formatWhen(user.lastLoginAt)} />
      </section>

      {user.restoreRequest ? (
        <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Access request
            </h2>
            <span className="text-[11px] font-medium text-[var(--color-muted)]">
              {user.restoreRequest.status === "PENDING"
                ? "Pending"
                : user.restoreRequest.status === "REJECTED"
                  ? "Rejected"
                  : "Restored"}{" "}
              · {formatWhen(user.restoreRequest.createdAt)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--color-text-secondary)]">
            {user.restoreRequest.message}
          </p>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Workspaces
        </h2>
        {workspaces.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white px-5 py-10 text-center text-sm text-[var(--color-muted)]">
            No workspaces for this account.
          </p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
            {workspaces.map((workspace) => (
              <li
                key={workspace.id}
                className="flex flex-col gap-1 border-b border-[var(--color-border)] px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="block text-[13px] font-medium text-[var(--color-text)]">
                    {workspace.name}
                  </span>
                  <span className="text-[12px] text-[var(--color-muted)]">
                    {workspace.agentCount} agent
                    {workspace.agentCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="flex flex-col items-start gap-1 sm:items-end">
                  <span className="text-[11px] text-[var(--color-muted)]">
                    Last activity {formatWhen(workspace.lastActivityAt)}
                  </span>
                  <Link
                    href={`/admin/users/${user.id}/workspaces/${workspace.id}`}
                    className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                  >
                    Inspect
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Suspend this user?</DialogTitle>
            <DialogDescription>
              {user.name} will not be able to sign in or use the product until
              you restore the account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={onSuspend}
            >
              {busy ? "Suspending…" : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteEmail("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently delete this user?</DialogTitle>
            <DialogDescription>
              This removes all workspaces, agents, knowledge, and conversations.
              Type <span className="font-medium text-[var(--color-text)]">{user.email}</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <input
            value={deleteEmail}
            onChange={(e) => setDeleteEmail(e.target.value)}
            placeholder={user.email}
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-danger)] focus:ring-2 focus:ring-[var(--color-danger)]/20"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                busy ||
                deleteEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
              }
              onClick={onDelete}
            >
              {busy ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
      <p className="text-[11px] font-medium text-[var(--color-muted)]">{label}</p>
      <p className={cn("mt-1 text-sm font-medium text-[var(--color-text)]")}>
        {value}
      </p>
    </div>
  );
}
