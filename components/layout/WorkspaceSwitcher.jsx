"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import {
  activateWorkspace,
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "@/lib/api/workspaces";
import { slugify as slugifyName } from "@/lib/utils/slugify";
import { hrefForWorkspaceSlug } from "@/lib/hooks/use-workspace-nav";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function mark(name) {
  return (name || "W").trim().charAt(0).toUpperCase() || "W";
}

export function WorkspaceSwitcher() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
    if (loading || !active?.slug) return;
    const next = hrefForWorkspaceSlug(
      active.slug,
      window.location.pathname,
      window.location.search
    );
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.location.replace(next);
    }
  }, [loading, active?.slug]);

  useEffect(() => {
    if (!workspaces.length) return;
    const parts = window.location.pathname.split("/").filter(Boolean);
    const urlSlug = parts[0] === "ws" ? parts[1] : null;
    if (!urlSlug) return;
    const match = workspaces.find((w) => w.slug === urlSlug);
    if (match && match.id !== activeId) {
      activateWorkspace(match.id).then(() => setActiveId(match.id)).catch(() => {});
    }
  }, [workspaces, activeId]);

  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

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
      const ws = workspaces.find((w) => w.id === id);
      const slug = ws?.slug || slugifyName(ws?.name || "");
      window.location.assign(
        hrefForWorkspaceSlug(slug, "/dashboard")
      );
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
      const created = await createWorkspace({ name: nameDraft });
      const slug = created?.slug || slugifyName(nameDraft);
      window.location.assign(hrefForWorkspaceSlug(slug, "/dashboard"));
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
      const updated = await updateWorkspace(active.id, { name: nameDraft });
      const slug = updated?.slug || slugifyName(nameDraft);
      window.location.assign(
        hrefForWorkspaceSlug(
          slug,
          window.location.pathname,
          window.location.search
        )
      );
    } catch (err) {
      setFormError(err.message || "Unable to rename workspace");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!active?.id) return;
    const hasAgents = (active.agentCount || 0) > 0;
    setBusy(true);
    setFormError("");
    try {
      const result = await deleteWorkspace(active.id, { confirm: hasAgents });
      const leftover = workspaces.find((w) => w.id !== active.id);
      const slug = result?.slug || leftover?.slug || slugifyName(leftover?.name || "");
      window.location.assign(hrefForWorkspaceSlug(slug, "/dashboard"));
    } catch (err) {
      setFormError(err.message || "Unable to delete workspace");
      setBusy(false);
      throw err;
    }
  }

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DropdownMenuTrigger
          className={cn(
            "flex h-10 w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-md px-2 text-left outline-none transition-[gap,padding,width,height] duration-300 ease-[var(--ease-ui)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            !collapsed && "hover:bg-sidebar-accent",
            collapsed && "justify-center gap-0 px-0"
          )}
          aria-label={`Workspace: ${active?.name || "Workspace"}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-[13px] font-semibold text-primary-foreground">
            {mark(active?.name)}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 overflow-hidden opacity-100 transition-[opacity,flex-basis,width] duration-300 ease-[var(--ease-ui)] motion-reduce:transition-none",
              collapsed && "pointer-events-none w-0 flex-none opacity-0"
            )}
          >
            <span
              className="block truncate font-heading text-sm font-semibold leading-tight text-sidebar-foreground"
              suppressHydrationWarning
            >
              {loading ? "Workspace" : active?.name || "Workspace"}
            </span>
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">
              Personal
            </span>
          </span>
          <ChevronsUpDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground opacity-100 transition-opacity duration-300 ease-[var(--ease-ui)] motion-reduce:transition-none",
              collapsed && "w-0 opacity-0"
            )}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={isMobile ? "bottom" : "right"}
          align="start"
          sideOffset={isMobile ? 4 : 8}
          className="w-64 min-w-64"
        >
          <div className="p-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspaces…"
              className="h-8"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <DropdownMenuGroup>
            {error ? (
              <p className="px-2 py-3 text-center text-xs text-destructive">
                {error}
              </p>
            ) : null}
            {filtered.map((workspace) => {
              const isActive = workspace.id === activeId;
              return (
                <DropdownMenuItem
                  key={workspace.id}
                  disabled={busy}
                  className="cursor-pointer gap-2"
                  onClick={() => switchTo(workspace.id)}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
                    {mark(workspace.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {workspace.name}
                  </span>
                  {isActive ? <Check className="text-primary" /> : null}
                </DropdownMenuItem>
              );
            })}
            {filtered.length === 0 && !error ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No workspaces match
              </p>
            ) : null}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                setOpen(false);
                setNameDraft("");
                setFormError("");
                setCreateOpen(true);
              }}
            >
              <Plus />
              Create a workspace
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                setOpen(false);
                setNameDraft(active?.name || "");
                setFormError("");
                setSettingsOpen(true);
              }}
            >
              <Settings2 />
              Workspace settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create a workspace</DialogTitle>
              <DialogDescription>
                Agents, knowledge, and analytics stay inside this workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 flex flex-col gap-2">
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
                <p className="text-xs text-destructive">{formError}</p>
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
            <div className="mt-3 flex flex-col gap-2">
              <Label htmlFor="workspace-rename">Name</Label>
              <Input
                id="workspace-rename"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={60}
                required
              />
              {formError ? (
                <p className="text-xs text-destructive">{formError}</p>
              ) : null}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy || workspaces.length <= 1}
                onClick={() => setDeleteConfirmOpen(true)}
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

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete workspace?"
        description={
          (active?.agentCount || 0) > 0
            ? `Delete “${active?.name}” and its ${active.agentCount} agent(s)? This cannot be undone.`
            : `Delete “${active?.name}”? This cannot be undone.`
        }
        confirmLabel="Delete workspace"
        loading={busy}
        error={formError}
        onConfirm={handleDelete}
      />
    </>
  );
}
