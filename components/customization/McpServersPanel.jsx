"use client";

import { useCallback, useEffect, useState } from "react";
import { Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  FieldBlock,
  fieldClass,
} from "@/components/customization/CustomizationFields";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createAgentMcpServer,
  deleteAgentMcpServer,
  listAgentMcpServers,
  probeAgentMcpServer,
  updateAgentMcpServer,
  updateAgentMcpTool,
} from "@/lib/api/mcp";
import { cn } from "@/lib/utils";

const EMPTY_FORM = {
  name: "Demo MCP",
  url: "",
  transport: "HTTP",
  authType: "NONE",
  headerName: "Authorization",
  enabled: true,
};

function defaultDemoUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:3000/api/demo/mcp";
  return `${window.location.origin}/api/demo/mcp`;
}

/**
 * F13-T3 — MCP tab: add server → probe → enable tool subset.
 */
export function McpServersPanel({ agentId, killOn = true }) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [probeBusy, setProbeBusy] = useState(null);
  const [toolBusy, setToolBusy] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const list = await listAgentMcpServers(agentId);
      setServers(list);
    } catch (err) {
      toast.error(err.message || "Unable to load MCP servers");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate(demo = false) {
    setForm({
      ...EMPTY_FORM,
      name: demo ? "Aide demo MCP" : "Custom MCP",
      url: demo ? defaultDemoUrl() : "",
      authType: "NONE",
    });
    setDialogOpen(true);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const created = await createAgentMcpServer(agentId, {
        name: form.name,
        url: form.url.trim(),
        transport: form.transport,
        authType: form.authType,
        headerName:
          form.authType === "HEADER" ? form.headerName || "Authorization" : null,
        enabled: form.enabled,
      });
      const server = created?.server || created;
      toast.success("MCP server saved — probing tools…");
      setDialogOpen(false);
      await load();
      if (server?.id) {
        await handleProbe(server.id);
      }
    } catch (err) {
      toast.error(err.message || "Unable to save MCP server");
    } finally {
      setSaving(false);
    }
  }

  async function handleProbe(serverId) {
    setProbeBusy(serverId);
    try {
      const result = await probeAgentMcpServer(agentId, serverId);
      toast.success(
        `Discovered ${result.discovered ?? result.server?.tools?.length ?? 0} tools`
      );
      await load();
    } catch (err) {
      toast.error(err.message || "MCP probe failed");
      await load();
    } finally {
      setProbeBusy(null);
    }
  }

  async function handleToggleServer(server, enabled) {
    try {
      await updateAgentMcpServer(agentId, server.id, { enabled });
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to update server");
    }
  }

  async function handleToggleTool(server, tool, enabled) {
    setToolBusy(tool.id);
    try {
      await updateAgentMcpTool(agentId, server.id, tool.id, { enabled });
      toast.success(enabled ? `${tool.name} enabled` : `${tool.name} off`);
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to update tool");
    } finally {
      setToolBusy(null);
    }
  }

  function handleDelete(server) {
    setConfirmState({
      title: "Delete MCP server?",
      description: `Remove “${server.name}” and its discovered tools?`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await deleteAgentMcpServer(agentId, server.id);
        toast.success("MCP server deleted");
        await load();
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">MCP servers</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Connect a remote MCP endpoint, discover tools, enable a subset.
            HTTPS + SSRF apply. Kill switch disables MCP with HTTP actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!killOn}
            onClick={() => openCreate(true)}
          >
            <Plug data-icon="inline-start" />
            Use demo MCP
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!killOn}
            onClick={() => openCreate(false)}
          >
            <Plus data-icon="inline-start" />
            Custom MCP server
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Spinner />
          Loading MCP…
        </div>
      ) : servers.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No MCP servers yet"
          description="Add Aide’s demo MCP or a remote Streamable HTTP endpoint, then enable tools for Studio."
          action={
            <Button type="button" size="sm" onClick={() => openCreate(true)}>
              <Plus data-icon="inline-start" />
              Use demo MCP
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {servers.map((server) => {
            const probing = probeBusy === server.id;
            return (
              <Card key={server.id} size="sm">
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CardTitle>{server.name}</CardTitle>
                      <Badge variant="outline" className="rounded-full">
                        {server.transport}
                      </Badge>
                      <Badge
                        variant={server.enabled ? "default" : "secondary"}
                        className="rounded-full"
                      >
                        {server.enabled ? "On" : "Off"}
                      </Badge>
                      {server.lastError ? (
                        <Badge variant="destructive" className="rounded-full">
                          Probe error
                        </Badge>
                      ) : null}
                    </div>
                    <CardDescription className="mt-1 font-mono text-[11px]">
                      {server.url}
                    </CardDescription>
                    {server.lastProbeAt ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Last probe{" "}
                        {new Date(server.lastProbeAt).toLocaleString()}
                      </p>
                    ) : null}
                    {server.lastError ? (
                      <p className="mt-1 text-[11px] text-destructive">
                        {server.lastError}
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    checked={server.enabled}
                    disabled={!killOn}
                    onCheckedChange={(checked) =>
                      handleToggleServer(server, checked === true)
                    }
                  />
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {(server.tools || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No tools yet — run Test connection / probe.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {server.tools.map((tool) => {
                        const busy = toolBusy === tool.id;
                        return (
                          <li
                            key={tool.id}
                            className={cn(
                              "flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border px-3 py-2",
                              tool.enabled && "ring-1 ring-primary/20"
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{tool.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {tool.functionName}
                                {" · "}
                                {tool.riskLevel}
                                {tool.requiresConfirmation
                                  ? " · needs confirm"
                                  : ""}
                              </p>
                              {tool.description ? (
                                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {tool.description}
                                </p>
                              ) : null}
                            </div>
                            <Switch
                              checked={tool.enabled}
                              disabled={busy || !killOn || !server.enabled}
                              onCheckedChange={(checked) =>
                                handleToggleTool(server, tool, checked === true)
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={probing || !killOn}
                    onClick={() => handleProbe(server.id)}
                  >
                    {probing ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <RefreshCw data-icon="inline-start" />
                    )}
                    Test connection
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDelete(server)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Alert>
        <Plug />
        <AlertTitle>Demo path</AlertTitle>
        <AlertDescription>
          Use demo MCP → probe → enable <code>get_demo_time</code> → ask in Test
          studio for the time. WRITE tool <code>create_demo_note</code> stays
          confirmation-gated until F14 chat consent.
        </AlertDescription>
      </Alert>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add MCP server</DialogTitle>
            <DialogDescription>
              Streamable HTTP preferred. Stdio is out of scope on serverless.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <FieldBlock label="Name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                className={fieldClass}
              />
            </FieldBlock>
            <FieldBlock label="URL" hint="HTTPS in production. Demo: /api/demo/mcp">
              <Input
                value={form.url}
                onChange={(e) =>
                  setForm((p) => ({ ...p, url: e.target.value }))
                }
                className={cn(fieldClass, "font-mono text-xs")}
                placeholder="https://mcp.example.com/mcp"
              />
            </FieldBlock>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldBlock label="Transport">
                <select
                  value={form.transport}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, transport: e.target.value }))
                  }
                  className={cn(
                    fieldClass,
                    "w-full border border-border bg-card px-3 text-sm"
                  )}
                >
                  <option value="HTTP">HTTP</option>
                  <option value="SSE">SSE</option>
                </select>
              </FieldBlock>
              <FieldBlock label="Auth">
                <select
                  value={form.authType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, authType: e.target.value }))
                  }
                  className={cn(
                    fieldClass,
                    "w-full border border-border bg-card px-3 text-sm"
                  )}
                >
                  <option value="NONE">None</option>
                  <option value="BEARER">Bearer</option>
                  <option value="HEADER">Header</option>
                </select>
              </FieldBlock>
            </div>
            {form.authType === "HEADER" ? (
              <FieldBlock label="Header name">
                <Input
                  value={form.headerName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, headerName: e.target.value }))
                  }
                  className={fieldClass}
                />
              </FieldBlock>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Attach a workspace credential on the server after create if auth
              is required (Integrations → Connection).
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || !form.name.trim() || !form.url.trim()}
              onClick={handleCreate}
            >
              {saving ? <Spinner data-icon="inline-start" /> : null}
              Save & probe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
        title={confirmState?.title || "Confirm"}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel || "Confirm"}
        variant="destructive"
        onConfirm={confirmState?.onConfirm}
      />
    </div>
  );
}
