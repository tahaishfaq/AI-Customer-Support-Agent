"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  getGithubMcpOauthStatus,
  listAgentMcpServers,
  probeAgentMcpServer,
  probeDraftAgentMcpServer,
  startGithubMcpOauth,
  updateAgentMcpServer,
  updateAgentMcpTool,
} from "@/lib/api/mcp";
import { filterMcpCatalog, getMcpCatalogEntry } from "@/lib/mcp/catalog";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query/keys";
import { invalidateMcpQuery } from "@/lib/query/invalidation";

const EMPTY_FORM = {
  name: "Demo MCP",
  url: "",
  transport: "HTTP",
  authType: "NONE",
  headerName: "Authorization",
  enabled: true,
  catalogId: null,
};

function defaultDemoUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:3000/api/demo/mcp";
  return `${window.location.origin}/api/demo/mcp`;
}

/**
 * F13-T3 / M01 UX-2 — MCP tab: catalog → add → probe → enable tool subset.
 */
export function McpServersPanel({ agentId, killOn = true }) {
  const queryClient = useQueryClient();
  const mcpQuery = useQuery({
    queryKey: queryKeys.mcp.list(agentId),
    queryFn: () => listAgentMcpServers(agentId),
    enabled: Boolean(agentId),
  });
  const servers = mcpQuery.data || [];
  const loading = mcpQuery.isPending;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftProbing, setDraftProbing] = useState(false);
  const [draftPreview, setDraftPreview] = useState(null);
  const [probeBusy, setProbeBusy] = useState(null);
  const [toolBusy, setToolBusy] = useState(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  const catalogEntries = filterMcpCatalog(catalogQuery);
  const isGithubDialog = form.catalogId === "github";
  const githubOauthQuery = useQuery({
    queryKey: ["mcp", "github-oauth", agentId],
    queryFn: () => getGithubMcpOauthStatus(agentId),
    enabled: Boolean(agentId) && dialogOpen && isGithubDialog,
  });
  const githubOauth = githubOauthQuery.data;

  async function refreshMcp() {
    await invalidateMcpQuery(queryClient, agentId);
  }

  function openFromCatalog(entryId) {
    const entry = getMcpCatalogEntry(entryId) || getMcpCatalogEntry("custom");
    const isDemo = entry.id === "aide-demo";
    const authType =
      entry.authHint === "bearer" || entry.authHint === "oauth"
        ? "BEARER"
        : entry.authHint === "header"
          ? "HEADER"
          : "NONE";
    setForm({
      ...EMPTY_FORM,
      catalogId: entry.id,
      name: entry.defaultName || entry.name,
      url: isDemo ? defaultDemoUrl() : entry.defaultUrl || "",
      authType,
      headerName: "Authorization",
    });
    setDraftPreview(null);
    setDialogOpen(true);
  }

  async function handleGithubOauthConnect() {
    setOauthBusy(true);
    try {
      const result = await startGithubMcpOauth(agentId, {
        name: form.name.trim() || "GitHub MCP",
        url: form.url.trim(),
      });
      if (!result?.authorizeUrl) {
        throw new Error("OAuth authorize URL missing");
      }
      window.location.assign(result.authorizeUrl);
    } catch (err) {
      toast.error(err.message || "Unable to start GitHub OAuth");
      setOauthBusy(false);
    }
  }

  async function handleDraftProbe() {
    setDraftProbing(true);
    setDraftPreview(null);
    try {
      const result = await probeDraftAgentMcpServer(agentId, {
        url: form.url.trim(),
        transport: form.transport,
        authType: form.authType,
        headerName:
          form.authType === "HEADER" ? form.headerName || "Authorization" : null,
      });
      setDraftPreview(result);
      toast.success(
        `Draft probe OK — ${result.discovered ?? result.tools?.length ?? 0} tools`
      );
    } catch (err) {
      toast.error(err.message || "Draft MCP probe failed");
    } finally {
      setDraftProbing(false);
    }
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
      setDraftPreview(null);
      await refreshMcp();
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
      await refreshMcp();
    } catch (err) {
      toast.error(err.message || "MCP probe failed");
      await refreshMcp();
    } finally {
      setProbeBusy(null);
    }
  }

  async function handleToggleServer(server, enabled) {
    try {
      await updateAgentMcpServer(agentId, server.id, { enabled });
      await refreshMcp();
    } catch (err) {
      toast.error(err.message || "Unable to update server");
    }
  }

  async function handleToggleTool(server, tool, enabled) {
    setToolBusy(tool.id);
    try {
      await updateAgentMcpTool(agentId, server.id, tool.id, { enabled });
      toast.success(enabled ? `${tool.name} enabled` : `${tool.name} off`);
      await refreshMcp();
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
        await refreshMcp();
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
            Enable tools, then mention them in agent instructions if the model
            never calls them.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Catalog</p>
          <Input
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            placeholder="Filter catalog…"
            className={cn(fieldClass, "h-8 max-w-[220px] text-xs")}
            disabled={!killOn}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalogEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={!killOn || entry.comingSoon}
              onClick={() => openFromCatalog(entry.id)}
              className={cn(
                "rounded-xl border border-border bg-muted/20 p-3 text-left transition-colors",
                killOn && !entry.comingSoon
                  ? "hover:border-primary/40 hover:bg-muted/40"
                  : "opacity-60"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {entry.name}
                </span>
                {entry.kind === "common" ? (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    Common
                  </Badge>
                ) : null}
                {entry.comingSoon ? (
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    Soon
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {entry.blurb}
              </p>
              {entry.authHint === "oauth" || entry.authHint === "bearer" ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {entry.authHint === "oauth"
                    ? "Auth: Connect with OAuth (or PAT)"
                    : "Auth: Bearer PAT (no OAuth yet)"}
                </p>
              ) : null}
            </button>
          ))}
        </div>
        {catalogEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No catalog matches.</p>
        ) : null}
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
          description="Pick Aide demo, Custom, or GitHub from the catalog, then enable tools for Studio."
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => openFromCatalog("aide-demo")}
            >
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
                        const isWrite =
                          tool.riskLevel === "WRITE" ||
                          tool.riskLevel === "DESTRUCTIVE" ||
                          tool.requiresConfirmation;
                        return (
                          <li
                            key={tool.id}
                            className={cn(
                              "flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border px-3 py-2",
                              tool.enabled && "ring-1 ring-primary/20"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-medium">{tool.name}</p>
                                {isWrite ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-[10px]"
                                  >
                                    Needs confirm
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full text-[10px]"
                                  >
                                    READ
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {tool.functionName}
                                {" · "}
                                {tool.riskLevel}
                              </p>
                              {tool.description ? (
                                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {tool.description}
                                </p>
                              ) : null}
                              {isWrite ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Writable MCP tools require visitor Confirm before
                                  the call (same path as HTTP WRITE).
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
          Use demo MCP → Test connection (draft) → Save &amp; probe → enable{" "}
          <code>aide_demo_get_time</code> (or legacy <code>get_demo_time</code>) →
          ask in Test studio. WRITE tools like{" "}
          <code>aide_demo_create_note</code> stay confirm-gated at runtime.
        </AlertDescription>
      </Alert>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDraftPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isGithubDialog ? "GitHub" : "Add MCP server"}
            </DialogTitle>
            <DialogDescription>
              {isGithubDialog
                ? "Remote GitHub MCP. OAuth uses a pre-registered GitHub OAuth App (no dynamic client registration)."
                : "Prefer Test connection before Save. Streamable HTTP preferred. Stdio is out of scope on serverless."}
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
                readOnly={isGithubDialog}
              />
            </FieldBlock>
            <FieldBlock
              label="URL"
              hint={
                isGithubDialog
                  ? "Official remote MCP host"
                  : "HTTPS in production. Demo: /api/demo/mcp"
              }
            >
              <Input
                value={form.url}
                onChange={(e) => {
                  setDraftPreview(null);
                  setForm((p) => ({ ...p, url: e.target.value }));
                }}
                className={cn(fieldClass, "font-mono text-xs")}
                placeholder="https://mcp.example.com/mcp"
                readOnly={isGithubDialog}
              />
            </FieldBlock>

            {isGithubDialog ? (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">
                  Authorize Aide to access GitHub on your behalf
                </p>
                {githubOauthQuery.isPending ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner className="size-3.5" />
                    Checking OAuth setup…
                  </div>
                ) : githubOauth?.configured ? (
                  <>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!killOn || oauthBusy || !form.url.trim()}
                      onClick={handleGithubOauthConnect}
                    >
                      {oauthBusy ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <ExternalLink data-icon="inline-start" />
                      )}
                      Connect with OAuth
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      You will leave Aide to authorize on GitHub, then return
                      here. Token is stored encrypted as a workspace credential.
                    </p>
                  </>
                ) : (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p className="text-amber-700 dark:text-amber-400">
                      Platform OAuth App not configured. GitHub MCP rejects
                      dynamic client registration — same as Botpress — so set
                      env secrets first.
                    </p>
                    <p>
                      Callback URL (register on the GitHub OAuth App):
                    </p>
                    <code className="block break-all rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[10px] text-foreground">
                      {githubOauth?.redirectUri ||
                        `${typeof window !== "undefined" ? window.location.origin : ""}/api/mcp/oauth/github/callback`}
                    </code>
                    <p>
                      Set{" "}
                      <code className="font-mono">GITHUB_MCP_OAUTH_CLIENT_ID</code>{" "}
                      and{" "}
                      <code className="font-mono">
                        GITHUB_MCP_OAUTH_CLIENT_SECRET
                      </code>
                      , restart, then reopen this dialog. Until then use Save
                      &amp; probe + PAT credential.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
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
                      onChange={(e) => {
                        setDraftPreview(null);
                        setForm((p) => ({ ...p, authType: e.target.value }));
                      }}
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
                {form.authType !== "NONE" ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Authenticated draft probe needs a workspace credential after
                    Save.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Test connection runs tools/list without saving. Save &amp;
                    probe persists the server and syncs tools.
                  </p>
                )}
              </>
            )}

            {!isGithubDialog && draftPreview?.tools?.length ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">
                  Draft preview ({draftPreview.discovered} tools)
                </p>
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
                  {draftPreview.tools.map((t) => (
                    <li key={t.name}>
                      {t.name}
                      {t.riskLevel === "WRITE" || t.requiresConfirmation
                        ? " · Needs confirm"
                        : " · READ"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            {!isGithubDialog ? (
              <Button
                type="button"
                variant="outline"
                disabled={
                  draftProbing ||
                  saving ||
                  !form.url.trim() ||
                  form.authType !== "NONE"
                }
                onClick={handleDraftProbe}
              >
                {draftProbing ? <Spinner data-icon="inline-start" /> : null}
                Test connection
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving || oauthBusy}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              {!isGithubDialog || !githubOauth?.configured ? (
                <Button
                  type="button"
                  disabled={saving || !form.name.trim() || !form.url.trim()}
                  onClick={handleCreate}
                >
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  Save &amp; probe
                </Button>
              ) : null}
            </div>
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
