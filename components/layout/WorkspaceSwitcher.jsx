"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronUp, Plus, Settings2 } from "lucide-react";
import {
  activateWorkspace,
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "@/lib/api/workspaces";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function mark(name) {
  const letter = (name || "W").trim().charAt(0).toUpperCase() || "W";
  return letter;
}

export function WorkspaceSwitcher() {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const active = workspaces.find((w) => w.id === activeId) || workspaces[0];

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listWorkspaces();
      setWorkspaces(data.workspaces || []);
      setActiveId(data.activeWorkspaceId);
    } catch (err) {
      setError(err.message || "Unable to load workspaces");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, query]);

  async function switchTo(id) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await activateWorkspace(id);
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to switch workspace");
      setBusy(false);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await createWorkspace({ name: nameDraft });
      window.location.assign("/dashboard");
    } catch (err) {
      setFormError(err.message || "Unable to create workspace");
      setBusy(false);
    }
  }

  async function handleRename(event) {
    event.preventDefault();
    if (!active?.id) return;
    setBusy(true);
    setFormError("");
    try {
      await updateWorkspace(active.id, { name: nameDraft });
      setSettingsOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || "Unable to rename workspace");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!active?.id) return;
    const hasAgents = (active.agentCount || 0) > 0;
    const ok = window.confirm(
      hasAgents
        ? `Delete “${active.name}” and its ${active.agentCount} agent(s)? This cannot be undone.`
        : `Delete “${active.name}”?`
    );
    if (!ok) return;
    setBusy(true);
    setFormError("");
    try {
      await deleteWorkspace(active.id, { confirm: hasAgents });
      window.location.assign("/dashboard");
    } catch (err) {
      setFormError(err.message || "Unable to delete workspace");
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center gap-2.5 rounded-md text-left outline-none hover:bg-[var(--color-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] font-[family-name:var(--font-display)] text-[13px] font-semibold text-white">
          {mark(active?.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-[family-name:var(--font-display)] text-sm font-semibold leading-tight text-[var(--color-text)]">
            {loading ? "Workspace" : active?.name || "Workspace"}
          </span>
          <span className="block truncate text-[11px] leading-tight text-[var(--color-muted)]">
            Personal
          </span>
        </span>
        <ChevronUp
          className={cn(
            "size-3.5 shrink-0 text-[var(--color-muted)] transition-transform",
            open ? "rotate-0" : "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          <div className="border-b border-[var(--color-border)] p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspaces…"
              className="h-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {error ? (
              <p className="px-2 py-3 text-center text-[12px] text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}
            {filtered.map((workspace) => {
              const isActive = workspace.id === activeId;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  disabled={busy}
                  onClick={() => switchTo(workspace.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-[var(--color-text)] hover:bg-[var(--color-bg)]",
                    isActive && "bg-[var(--color-primary)]/8"
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[10px] font-semibold text-[var(--color-primary)]">
                    {mark(workspace.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {isActive ? (
                    <Check className="size-3.5 shrink-0 text-[var(--color-primary)]" />
                  ) : null}
                </button>
              );
            })}
            {filtered.length === 0 && !error ? (
              <p className="px-2 py-3 text-center text-[12px] text-[var(--color-muted)]">
                No workspaces match
              </p>
            ) : null}
          </div>
          <div className="space-y-px border-t border-[var(--color-border)] p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNameDraft("");
                setFormError("");
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg)]"
            >
              <Plus className="size-3.5" />
              Create a workspace
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNameDraft(active?.name || "");
                setFormError("");
                setSettingsOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
            >
              <Settings2 className="size-3.5" />
              Workspace settings
            </button>
          </div>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create a workspace</DialogTitle>
              <DialogDescription>
                Agents, knowledge, and analytics stay inside this workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-2">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={60}
                required
                placeholder="Acme Support"
              />
              {formError ? (
                <p className="text-[12px] text-[var(--color-danger)]">{formError}</p>
              ) : null}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !nameDraft.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Workspace settings</DialogTitle>
              <DialogDescription>
                Rename this workspace or delete it. Deleting removes its agents.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-2">
              <Label htmlFor="workspace-rename">Name</Label>
              <Input
                id="workspace-rename"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={60}
                required
              />
              {formError ? (
                <p className="text-[12px] text-[var(--color-danger)]">{formError}</p>
              ) : null}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy || workspaces.length <= 1}
                onClick={handleDelete}
              >
                Delete
              </Button>
              <Button type="submit" disabled={busy || !nameDraft.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
