"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Cable, Play, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FieldBlock,
  FormSection,
} from "@/components/customization/CustomizationFields";
import { HttpToolDialog } from "@/components/customization/HttpToolDialog";
import {
  createAgentAction,
  deleteAgentAction,
  listAgentActions,
  listAgentToolRuns,
  testAgentAction,
  updateAgentAction,
} from "@/lib/api/actions";
import { listAgentConfirmations } from "@/lib/api/confirmations";
import {
  createAgentCredential,
  listAgentCredentials,
  revokeAgentCredential,
} from "@/lib/api/credentials";
import { updateAgent } from "@/lib/api/agents";
import { ACTION_TEMPLATES } from "@/lib/actions/action-config";
import { inferAccessClass } from "@/lib/actions/access-class";
import { cn } from "@/lib/utils";

function demoOriginUrl(pathWithArg) {
  if (typeof window === "undefined") {
    return `http://localhost:3000${pathWithArg}`;
  }
  return `${window.location.origin}${pathWithArg}`;
}

function schemaText(schema) {
  const value =
    schema && typeof schema === "object" && !Array.isArray(schema)
      ? schema
      : {};
  return JSON.stringify(value, null, 2);
}

function blankForm() {
  const inputSchemaJson = { campaignId: "string" };
  return {
    name: "",
    description: "",
    method: "GET",
    urlTemplate: "http://127.0.0.1:8000/api/v1/campaigns/{{campaignId}}",
    headersJsonText: '{\n  "Accept": "application/json"\n}',
    inputSchemaJson,
    inputSchemaJsonText: schemaText(inputSchemaJson),
    enabled: true,
    timeoutMs: 8000,
    credentialId: "",
    riskLevel: "READ",
    requiresConfirmation: false,
    requiresIdentity: false,
    identityMode: "NONE",
    accessClass: "PUBLIC_READ",
    idempotent: true,
    testArgsText: '{\n  "campaignId": "6a7229b34a438ace7e21e325"\n}',
  };
}

function formFromTemplate(template) {
  let urlTemplate = template.urlTemplate;
  if (template.id === "demo_order_status") {
    urlTemplate = demoOriginUrl("/api/demo/orders/{{orderId}}");
  } else if (template.id === "demo_campaign_status") {
    urlTemplate = demoOriginUrl("/api/demo/campaigns/{{campaignId}}");
  }
  const inputSchemaJson = template.inputSchemaJson || {};
  return {
    name: template.name,
    description: template.description,
    method: template.method,
    urlTemplate,
    headersJsonText: JSON.stringify(template.headersJson || {}, null, 2),
    inputSchemaJson,
    inputSchemaJsonText: schemaText(inputSchemaJson),
    enabled: true,
    timeoutMs: 8000,
    credentialId: "",
    riskLevel: template.riskLevel || "READ",
    requiresConfirmation: Boolean(template.requiresConfirmation),
    requiresIdentity: Boolean(template.requiresIdentity),
    identityMode:
      template.identityMode ||
      (template.requiresIdentity ? "END_USER_TOKEN" : "NONE"),
    accessClass:
      template.accessClass ||
      (template.requiresIdentity
        ? template.riskLevel === "DESTRUCTIVE"
          ? "DESTRUCTIVE"
          : template.riskLevel === "WRITE"
            ? "ACCOUNT_WRITE"
            : "ACCOUNT_READ"
        : "PUBLIC_READ"),
    idempotent: template.idempotent !== false,
    testArgsText: JSON.stringify(template.testArgs || {}, null, 2),
  };
}

function formFromAction(action) {
  const schema =
    action.inputSchemaJson &&
    typeof action.inputSchemaJson === "object" &&
    !Array.isArray(action.inputSchemaJson)
      ? action.inputSchemaJson
      : {};
  const keys = Object.keys(schema);
  let testArgs = {};
  if (keys.includes("campaignId")) {
    testArgs = { campaignId: "6a7229b34a438ace7e21e325" };
  } else if (keys.includes("orderId")) {
    testArgs = { orderId: "ORD-100" };
  } else if (keys.includes("query")) {
    testArgs = { query: "Hel" };
  } else if (keys.length) {
    testArgs = Object.fromEntries(keys.map((k) => [k, ""]));
  }
  const inputSchemaJson = Object.keys(schema).length
    ? schema
    : { campaignId: "string" };
  return {
    name: action.name,
    description: action.description,
    method: action.method || "GET",
    urlTemplate: action.urlTemplate || "",
    headersJsonText: action.headersJson
      ? JSON.stringify(action.headersJson, null, 2)
      : "{}",
    inputSchemaJson,
    inputSchemaJsonText: schemaText(inputSchemaJson),
    enabled: Boolean(action.enabled),
    timeoutMs: action.timeoutMs || 8000,
    credentialId: action.credentialId || "",
    riskLevel: action.riskLevel || "READ",
    requiresConfirmation: Boolean(action.requiresConfirmation),
    requiresIdentity: Boolean(action.requiresIdentity),
    identityMode:
      action.identityMode ||
      (action.requiresIdentity ? "END_USER_TOKEN" : "NONE"),
    accessClass: action.accessClass || "PUBLIC_READ",
    idempotent: action.idempotent !== false,
    testArgsText: JSON.stringify(testArgs, null, 2),
    isDemoUrl: /\/api\/demo\//i.test(String(action.urlTemplate || "")),
  };
}

const EMPTY_FORM = blankForm();

function isDemoActionUrl(url) {
  return /\/api\/demo\//i.test(String(url || ""));
}

function parseJsonObject(text, label) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}

export function ActionsForm({
  agentId,
  agentName,
  actionsEnabled = true,
  onActionsEnabledChange,
  siteKnowledgeOrigin = null,
  pendingCreateForm = null,
  onPendingCreateConsumed,
}) {
  const [tab, setTab] = useState("http");
  const [actions, setActions] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [runs, setRuns] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [killBusy, setKillBusy] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testResult, setTestResult] = useState(null);
  const [editorTab, setEditorTab] = useState("params");
  const [credForm, setCredForm] = useState({
    name: "Brandly API",
    secret: "",
    type: "API_KEY_HEADER",
    headerName: "X-API-KEY",
  });
  const [credBusy, setCredBusy] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const killOn = actionsEnabled !== false;

  const activeCreds = useMemo(
    () => credentials.filter((c) => !c.revokedAt),
    [credentials]
  );
  const primaryCred = activeCreds[0] || null;

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const [list, recentRuns, creds, recentConfirmations] = await Promise.all([
        listAgentActions(agentId),
        listAgentToolRuns(agentId, { take: 20 }).catch(() => []),
        listAgentCredentials(agentId).catch(() => []),
        listAgentConfirmations(agentId, { take: 20 }).catch(() => []),
      ]);
      setActions(list);
      setRuns(recentRuns);
      setCredentials(creds);
      setConfirmations(recentConfirmations);
    } catch (err) {
      toast.error(err.message || "Unable to load actions");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pendingCreateForm) return;
    openCreateFromSlot(pendingCreateForm);
    onPendingCreateConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when parent hands a pack slot
  }, [pendingCreateForm]);

  function patchForm(partial) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setTestResult(null);
    setEditorTab("params");
  }

  function openCreate(template = null) {
    setEditingId(null);
    const base = template ? formFromTemplate(template) : blankForm();
    if (primaryCred && !base.credentialId) {
      base.credentialId = primaryCred.id;
    }
    setForm(base);
    setTestResult(null);
    setEditorTab("params");
    setEditorOpen(true);
    setTab("http");
  }

  function openCreateFromSlot(slotForm) {
    setEditingId(null);
    const base = { ...blankForm(), ...slotForm };
    if (typeof window !== "undefined" && base.urlTemplate) {
      base.urlTemplate = String(base.urlTemplate).replace(
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i,
        window.location.origin
      );
    }
    if (primaryCred && !base.credentialId) {
      base.credentialId = primaryCred.id;
    }
    setForm(base);
    setTestResult(null);
    setEditorTab("params");
    setEditorOpen(true);
    setTab("http");
  }

  function openEdit(action) {
    setEditingId(action.id);
    setForm(formFromAction(action));
    setTestResult(null);
    setEditorTab("params");
    setEditorOpen(true);
    setTab("http");
  }

  async function handleCreateCredential() {
    setCredBusy(true);
    try {
      await createAgentCredential(agentId, {
        name: credForm.name || "API key",
        secret: credForm.secret,
        type: credForm.type,
        headerName:
          credForm.type === "API_KEY_HEADER"
            ? credForm.headerName || "X-API-KEY"
            : undefined,
      });
      toast.success("API key saved");
      setCredForm((p) => ({ ...p, secret: "" }));
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to save API key");
    } finally {
      setCredBusy(false);
    }
  }

  async function handleRevoke(cred) {
    setConfirmState({
      title: "Revoke this API key?",
      description:
        "Tools using this key will stop until you save a new one. You can’t undo revoke — paste a fresh key to reconnect.",
      confirmLabel: "Revoke key",
      onConfirm: async () => {
        try {
          await revokeAgentCredential(agentId, cred.id);
          toast.success("API key revoked");
          await load();
        } catch (err) {
          toast.error(err.message || "Unable to revoke key");
          throw err;
        }
      },
    });
  }

  async function handleKillSwitch() {
    setKillBusy(true);
    try {
      const next = !killOn;
      const updated = await updateAgent(agentId, { actionsEnabled: next });
      onActionsEnabledChange?.(Boolean(updated.actionsEnabled));
      toast.success(
        next ? "Live data enabled" : "All live data actions disabled"
      );
    } catch (err) {
      toast.error(err.message || "Unable to update kill switch");
    } finally {
      setKillBusy(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const headersJson = parseJsonObject(form.headersJsonText, "Headers");
      const inputSchemaJson =
        parseJsonObject(form.inputSchemaJsonText, "Inputs") ||
        form.inputSchemaJson ||
        {};
      const payload = {
        name: form.name,
        description: form.description,
        method: form.method,
        urlTemplate: form.urlTemplate.trim(),
        headersJson,
        enabled: form.enabled,
        timeoutMs: Number(form.timeoutMs) || 8000,
        inputSchemaJson,
        credentialId: form.credentialId || null,
        riskLevel: form.riskLevel || "READ",
        requiresConfirmation: Boolean(form.requiresConfirmation),
        identityMode: form.identityMode || "NONE",
        accessClass: form.accessClass || "PUBLIC_READ",
        requiresIdentity:
          (form.identityMode || "NONE") === "END_USER_TOKEN" ||
          Boolean(form.requiresIdentity),
        idempotent: form.idempotent !== false,
      };

      if (editingId) {
        const updated = await updateAgentAction(agentId, editingId, payload);
        const saved = updated?.id ? updated : updated?.action || payload;
        toast.success("HTTP tool updated");
        setForm(
          formFromAction({
            ...saved,
            urlTemplate: saved.urlTemplate || payload.urlTemplate,
          })
        );
        setEditingId(saved.id || editingId);
      } else {
        const created = await createAgentAction(agentId, payload);
        const saved = created?.id ? created : created?.action || payload;
        toast.success("HTTP tool created");
        setForm(
          formFromAction({
            ...saved,
            urlTemplate: saved.urlTemplate || payload.urlTemplate,
          })
        );
        setEditingId(saved.id || null);
      }
      setTestResult(null);
      setEditorOpen(true);
      await load();
    } catch (err) {
      const detail = Object.values(err.details || {}).find(Boolean);
      toast.error(
        detail && detail !== err.message
          ? `${err.message}: ${detail}`
          : err.message || "Unable to save action"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(action) {
    setConfirmState({
      title: "Delete action?",
      description: `Delete action “${action.name}”? This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await deleteAgentAction(agentId, action.id);
          toast.success("Action deleted");
          if (editingId === action.id) {
            closeEditor();
          }
          await load();
        } catch (err) {
          toast.error(err.message || "Unable to delete action");
          throw err;
        }
      },
    });
  }

  async function handleToggle(action) {
    try {
      await updateAgentAction(agentId, action.id, { enabled: !action.enabled });
      await load();
    } catch (err) {
      toast.error(err.message || "Unable to update action");
    }
  }

  async function handleTest(action) {
    setTestingId(action.id);
    setTestResult(null);
    try {
      const argsSource =
        editingId === action.id
          ? form.testArgsText
          : JSON.stringify(
              ACTION_TEMPLATES.find((t) => t.name === action.name)?.testArgs ||
                {},
              null,
              2
            );
      const args = parseJsonObject(argsSource, "Test args") || {};
      const data = await testAgentAction(agentId, action.id, args);
      setTestResult(data.result);
      if (data.result?.ok) toast.success("Action test ok");
      else toast.error(data.result?.bodyText || "Action test failed");
      listAgentToolRuns(agentId, { take: 20 })
        .then(setRuns)
        .catch(() => {});
    } catch (err) {
      toast.error(err.message || "Unable to test action");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (next) setTab(next);
        }}
      >
        <TabsList variant="line" className="h-auto w-full justify-start gap-4">
          <TabsTrigger value="http" className="px-0 pb-2.5">
            HTTP
          </TabsTrigger>
          <TabsTrigger value="integrations" className="px-0 pb-2.5">
            Integrations
          </TabsTrigger>
          <TabsTrigger value="mcp" className="px-0 pb-2.5">
            MCP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-4">
          <EmptyState
            icon={Cable}
            title="Channel integrations coming soon"
            description="WhatsApp, Slack, Monday, Jira, and other connectors will land here. Business starter packs are under Customization → Packs. Use HTTP tools for live APIs now."
          />
        </TabsContent>

        <TabsContent value="mcp" className="mt-4">
          <EmptyState
            icon={Cable}
            title="Coming soon"
            description="MCP servers will land here. Use HTTP tools for now."
          />
        </TabsContent>

        <TabsContent value="http" className="mt-4 flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">HTTP Request</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Run an HTTP call as a tool. For advanced use cases with custom
                headers and bodies.
                {!killOn ? " · actions off" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {killOn ? "On" : "Off"}
                </span>
                {killBusy ? <Spinner className="size-3.5" /> : null}
                <Switch
                  checked={killOn}
                  disabled={killBusy}
                  onCheckedChange={() => handleKillSwitch()}
                  aria-label="Enable live actions"
                />
              </div>
              <Button type="button" size="sm" onClick={() => openCreate()}>
                <Plus data-icon="inline-start" />
                Add HTTP tool
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner />
              Loading tools…
            </div>
          ) : actions.length === 0 ? (
            <EmptyState
              icon={Cable}
              title="No HTTP tools yet"
              description="Add a custom HTTP tool. Knowledge still answers FAQ first."
              action={
                <Button type="button" size="sm" onClick={() => openCreate()}>
                  <Plus data-icon="inline-start" />
                  Add HTTP tool
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {actions.map((action) => (
                <Card
                  key={action.id}
                  size="sm"
                  className={cn(action.enabled && "ring-1 ring-primary/20")}
                >
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(action)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            action.method === "POST" ? "secondary" : "outline"
                          }
                          className="rounded-full font-mono text-[10px]"
                        >
                          {action.method || "GET"}
                        </Badge>
                        <CardTitle className="truncate">{action.name}</CardTitle>
                        <Badge
                          variant={
                            isDemoActionUrl(action.urlTemplate)
                              ? "outline"
                              : "secondary"
                          }
                          className="rounded-full"
                        >
                          {isDemoActionUrl(action.urlTemplate) ? "demo" : "live"}
                        </Badge>
                        {(() => {
                          const cls = inferAccessClass(action);
                          if (
                            cls === "GUEST_LOOKUP" ||
                            cls === "PUBLIC_READ"
                          ) {
                            return (
                              <Badge
                                variant="outline"
                                className="rounded-full text-[10px]"
                              >
                                Guest
                              </Badge>
                            );
                          }
                          if (
                            cls === "ACCOUNT_READ" ||
                            cls === "ACCOUNT_WRITE" ||
                            cls === "DESTRUCTIVE"
                          ) {
                            return (
                              <Badge
                                variant="outline"
                                className="rounded-full text-[10px]"
                              >
                                Signed-in
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                        {action.requiresConfirmation ||
                        action.riskLevel === "WRITE" ||
                        action.riskLevel === "DESTRUCTIVE" ? (
                          <Badge
                            variant="secondary"
                            className="rounded-full text-[10px]"
                          >
                            Confirm
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="mt-1 line-clamp-2">
                        {action.description || "No description"}
                      </CardDescription>
                    </button>
                    <Switch
                      checked={action.enabled}
                      onCheckedChange={() => handleToggle(action)}
                    />
                  </CardHeader>
                  <CardContent>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {action.urlTemplate}
                    </p>
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(action)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={testingId === action.id || !killOn}
                      onClick={() => handleTest(action)}
                    >
                      {testingId === action.id ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Play data-icon="inline-start" />
                      )}
                      Test
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDelete(action)}
                      aria-label={`Delete ${action.name}`}
                    >
                      <Trash2 data-icon="inline-start" />
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {testResult ? (
            <FormSection title="Last test result">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">
                  {testResult.status}
                  {testResult.httpStatus != null
                    ? ` · HTTP ${testResult.httpStatus}`
                    : ""}
                  {testResult.durationMs != null
                    ? ` · ${testResult.durationMs}ms`
                    : ""}
                </p>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-card p-3 font-mono text-[11px]">
                  {testResult.bodyText || "(empty)"}
                </pre>
              </div>
            </FormSection>
          ) : null}

          <FormSection title="Recent tool runs">
            <FieldBlock
              label="Audit"
              hint="Name, status, duration only — no response bodies or secrets."
            >
              {runs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No tool runs yet.
                </p>
              ) : (
                <ul className="max-h-56 overflow-auto rounded-xl border border-border bg-card p-2">
                  {runs.map((run) => (
                    <li
                      key={run.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-2 py-1.5 text-xs"
                    >
                      <span className="font-medium">
                        {run.actionName || "unknown"}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {run.status}
                          {run.httpStatus != null
                            ? ` · ${run.httpStatus}`
                            : ""}
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {run.durationMs != null
                          ? `${run.durationMs}ms · `
                          : ""}
                        {run.createdAt
                          ? new Date(run.createdAt).toLocaleString()
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </FieldBlock>
          </FormSection>

          <FormSection title="Consent evidence">
            <FieldBlock
              label="Confirmations"
              hint="Who approved or denied a write action — evidence id, subject, time, args hash."
            >
              {confirmations.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No confirmations yet. Write / confirm-gated tools create rows
                  when the visitor sees Confirm in chat.
                </p>
              ) : (
                <ul className="max-h-56 overflow-auto rounded-xl border border-border bg-card p-2">
                  {confirmations.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-col gap-0.5 border-b border-border/60 px-2 py-2 text-xs last:border-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {row.actionName || "action"}
                          <Badge
                            variant={
                              row.status === "APPROVED"
                                ? "default"
                                : row.status === "DENIED"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="ml-2 rounded-full"
                          >
                            {row.status}
                          </Badge>
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {row.decidedAt
                            ? new Date(row.decidedAt).toLocaleString()
                            : row.createdAt
                              ? new Date(row.createdAt).toLocaleString()
                              : ""}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {row.evidenceId || "pending"}
                        {row.userDisplay || row.userSubject
                          ? ` · ${row.userDisplay || row.userSubject}`
                          : " · anonymous"}
                        {row.argsHash
                          ? ` · args ${String(row.argsHash).slice(0, 10)}…`
                          : ""}
                        {row.decidedIp ? ` · ${row.decidedIp}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </FieldBlock>
          </FormSection>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p>
                Only owner-defined URLs — no flow canvas, no scrape, no direct
                DB.
              </p>
              <p className="mt-1">
                SSRF blocks private hosts. Outbound calls are rate-limited per
                agent.
              </p>
            </div>
          </div>

          <HttpToolDialog
            open={editorOpen}
            onOpenChange={(open) => {
              if (!open) closeEditor();
              else setEditorOpen(true);
            }}
            editingId={editingId}
            form={form}
            patchForm={patchForm}
            editorTab={editorTab}
            onEditorTabChange={setEditorTab}
            activeCreds={activeCreds}
            saving={saving}
            onSave={handleSave}
            onDelete={
              editingId
                ? () =>
                    handleDelete({
                      id: editingId,
                      name: form.name || "tool",
                    })
                : undefined
            }
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
        title={confirmState?.title || "Confirm"}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel || "Confirm"}
        variant={confirmState?.variant || "destructive"}
        onConfirm={confirmState?.onConfirm}
      />
    </div>
  );
}
