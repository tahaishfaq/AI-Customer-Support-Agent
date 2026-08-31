"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SECRET_REDACT_PLACEHOLDER } from "@/lib/actions/action-config";
import {
  ACCESS_CLASSES,
  applyAccessClass,
  inferAccessClass,
} from "@/lib/actions/access-class";
import { cn } from "@/lib/utils";

function splitUrlQuery(urlTemplate) {
  const raw = String(urlTemplate || "");
  const i = raw.indexOf("?");
  if (i < 0) return { base: raw, params: [] };
  const base = raw.slice(0, i);
  const qs = raw.slice(i + 1);
  const params = qs
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return { key: safeDecode(part), value: "" };
      return {
        key: safeDecode(part.slice(0, eq)),
        value: safeDecode(part.slice(eq + 1)),
      };
    });
  return { base, params };
}

function safeDecode(s) {
  try {
    return decodeURIComponent(String(s || ""));
  } catch {
    return String(s || "");
  }
}

function joinUrlQuery(base, params) {
  const parts = (params || [])
    .filter((p) => String(p.key || "").trim())
    .map((p) => {
      const k = encodeURIComponent(String(p.key).trim());
      const v = encodeURIComponent(String(p.value ?? ""));
      return `${k}=${v}`;
    });
  if (!parts.length) return base;
  return `${base}?${parts.join("&")}`;
}

function schemaToInputs(text) {
  try {
    const parsed = JSON.parse(String(text || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    if (parsed.type === "object" && parsed.properties) {
      return Object.entries(parsed.properties).map(([name, def]) => ({
        name,
        type:
          def && typeof def === "object" && def.type
            ? String(def.type)
            : "string",
      }));
    }
    return Object.entries(parsed)
      .filter(([k]) => !["type", "properties", "required"].includes(k))
      .map(([name, raw]) => ({
        name,
        type: typeof raw === "string" ? raw : "string",
      }));
  } catch {
    return [];
  }
}

function inputsToSchemaText(inputs) {
  const obj = {};
  for (const row of inputs) {
    const name = String(row.name || "").trim();
    if (!name) continue;
    obj[name] = String(row.type || "string").trim() || "string";
  }
  return JSON.stringify(obj, null, 2);
}

function headerCount(headersJsonText) {
  try {
    const o = JSON.parse(String(headersJsonText || "{}"));
    if (!o || typeof o !== "object" || Array.isArray(o)) return 0;
    return Object.keys(o).filter((k) => k.trim()).length;
  } catch {
    return 0;
  }
}

function TabDot({ on }) {
  if (!on) return null;
  return (
    <span
      className="ml-1 inline-block size-1.5 rounded-full bg-primary"
      aria-hidden
    />
  );
}

const selectClass =
  "flex h-8 shrink-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * HTTP tool editor — compact Botpress-style layout.
 */
export function HttpToolDialog({
  open,
  onOpenChange,
  editingId,
  form,
  patchForm,
  editorTab,
  onEditorTabChange,
  activeCreds = [],
  saving = false,
  onSave,
  onDelete,
}) {
  const title = editingId ? "Edit HTTP tool" : "Add HTTP tool";
  const { base, params } = useMemo(
    () => splitUrlQuery(form.urlTemplate),
    [form.urlTemplate]
  );
  const inputs = useMemo(
    () => schemaToInputs(form.inputSchemaJsonText),
    [form.inputSchemaJsonText]
  );
  const hdrCount = useMemo(
    () => headerCount(form.headersJsonText),
    [form.headersJsonText]
  );
  const hasAuth = Boolean(form.credentialId);
  const requestTab = ["params", "body", "auth", "headers"].includes(editorTab)
    ? editorTab
    : "params";
  const [showDevMode, setShowDevMode] = useState(false);
  const accessClass =
    form.accessClass ||
    inferAccessClass({
      name: form.name,
      description: form.description,
      identityMode: form.identityMode,
      riskLevel: form.riskLevel,
      requiresIdentity: form.requiresIdentity,
    });

  function setParams(nextParams) {
    patchForm({ urlTemplate: joinUrlQuery(base, nextParams) });
  }

  function setBaseUrl(nextBase) {
    patchForm({ urlTemplate: joinUrlQuery(nextBase, params) });
  }

  function setInputs(nextInputs) {
    patchForm({
      inputSchemaJsonText: inputsToSchemaText(nextInputs),
      inputSchemaJson: Object.fromEntries(
        nextInputs
          .filter((r) => String(r.name || "").trim())
          .map((r) => [r.name.trim(), String(r.type || "string")])
      ),
    });
  }

  function onAccessClassChange(nextId) {
    const mapped = applyAccessClass(nextId);
    if (!mapped) return;
    patchForm(mapped);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,720px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3.5 pr-12">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <FieldGroup className="gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="http-tool-name">Name</FieldLabel>
                <Input
                  id="http-tool-name"
                  value={form.name}
                  onChange={(e) => patchForm({ name: e.target.value })}
                  placeholder="GetCampaigns"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="http-tool-desc">Description</FieldLabel>
                <Input
                  id="http-tool-desc"
                  value={form.description}
                  onChange={(e) => patchForm({ description: e.target.value })}
                  placeholder="Fetches active brand campaigns from backend"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Request</FieldLabel>
              {/* Method outside InputGroup — native <select> inside overflow-hidden groups flickers / won't open */}
              <div className="flex gap-2">
                <select
                  value={form.method}
                  onChange={(e) => patchForm({ method: e.target.value })}
                  className={cn(selectClass, "w-[5.5rem] font-medium")}
                  aria-label="HTTP method"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
                <Input
                  value={base}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1/campaigns"
                  className="min-w-0 flex-1 font-mono text-xs"
                  aria-label="URL template"
                />
              </div>
              <FieldDescription>
                URL template — Use {"{{variables}}"} in the path or query.
                Production URLs must be HTTPS. SSRF protection blocks private
                IPs and non-allowlisted hosts; local demo (127.0.0.1) is allowed
                in development only.
              </FieldDescription>
            </Field>

            <Tabs
              value={requestTab}
              onValueChange={(next) => {
                if (next) onEditorTabChange?.(next);
              }}
              className="gap-0"
            >
              <TabsList variant="default" className="h-8 w-fit gap-0.5">
                <TabsTrigger value="params" className="px-2.5 text-xs">
                  Params
                  <TabDot on={params.length > 0} />
                  {params.length ? (
                    <span className="text-muted-foreground">
                      ({params.length})
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="body" className="px-2.5 text-xs">
                  Body
                </TabsTrigger>
                <TabsTrigger value="auth" className="px-2.5 text-xs">
                  Auth
                  <TabDot on={hasAuth} />
                </TabsTrigger>
                <TabsTrigger value="headers" className="px-2.5 text-xs">
                  Headers
                  {hdrCount ? (
                    <span className="text-muted-foreground">({hdrCount})</span>
                  ) : (
                    <span className="text-muted-foreground">(0)</span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Stable panel height — same size for every request tab */}
              <div className="mt-2 rounded-xl border border-border bg-muted/20 p-3">
                <div className="h-40 overflow-y-auto">
                  <TabsContent
                    value="params"
                    className="mt-0 flex flex-col gap-2 outline-none"
                  >
                    {params.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No query parameters yet.
                      </p>
                    ) : (
                      params.map((row, idx) => (
                        <div
                          key={`param-${idx}`}
                          className="grid grid-cols-[1fr_1fr_auto] gap-2"
                        >
                          <Input
                            value={row.key}
                            placeholder="key"
                            onChange={(e) => {
                              const next = params.map((p, i) =>
                                i === idx ? { ...p, key: e.target.value } : p
                              );
                              setParams(next);
                            }}
                          />
                          <Input
                            value={row.value}
                            placeholder="value or {{variable}}"
                            className="font-mono text-xs"
                            onChange={(e) => {
                              const next = params.map((p, i) =>
                                i === idx ? { ...p, value: e.target.value } : p
                              );
                              setParams(next);
                            }}
                          />
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Remove parameter"
                            onClick={() =>
                              setParams(params.filter((_, i) => i !== idx))
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-fit px-0 text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setParams([...params, { key: "", value: "" }])
                      }
                    >
                      <Plus data-icon="inline-start" />
                      Add parameter
                    </Button>
                  </TabsContent>

                  <TabsContent value="body" className="mt-0 outline-none">
                    <Textarea
                      value={form.testArgsText}
                      onChange={(e) =>
                        patchForm({ testArgsText: e.target.value })
                      }
                      className="h-36 min-h-0 resize-none font-mono text-xs"
                      placeholder='{\n  "campaignId": "…"\n}'
                      aria-label="Request body JSON"
                    />
                  </TabsContent>

                  <TabsContent
                    value="auth"
                    className="mt-0 flex flex-col gap-2 outline-none"
                  >
                    <Field>
                      <FieldLabel>Credential</FieldLabel>
                      <select
                        value={form.credentialId || ""}
                        onChange={(e) =>
                          patchForm({ credentialId: e.target.value })
                        }
                        className={cn(selectClass, "w-full")}
                      >
                        <option value="">None</option>
                        {activeCreds.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                      </select>
                      <FieldDescription>
                        Public Brandly reads: attach an{" "}
                        <span className="font-medium">API_KEY_HEADER</span>{" "}
                        credential with header{" "}
                        <code className="rounded bg-muted px-1 text-[11px]">
                          X-API-KEY
                        </code>
                        . Without it the API returns 401.
                      </FieldDescription>
                    </Field>
                  </TabsContent>

                  <TabsContent
                    value="headers"
                    className="mt-0 flex flex-col gap-2 outline-none"
                  >
                    <FieldDescription>
                      JSON object. Secrets show as {SECRET_REDACT_PLACEHOLDER}.
                    </FieldDescription>
                    <Textarea
                      value={form.headersJsonText}
                      onChange={(e) =>
                        patchForm({ headersJsonText: e.target.value })
                      }
                      className="h-28 min-h-0 resize-none font-mono text-xs"
                    />
                  </TabsContent>
                </div>
              </div>
            </Tabs>

            <Field>
              <FieldLabel>Who can use this tool?</FieldLabel>
              <select
                value={accessClass}
                onChange={(e) => onAccessClassChange(e.target.value)}
                className={cn(selectClass, "w-full")}
              >
                {ACCESS_CLASSES.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
              <FieldDescription>
                {ACCESS_CLASSES.find((r) => r.id === accessClass)?.hint ||
                  "Pick the visitor audience. Embed always asks Confirm before a live call."}
              </FieldDescription>
            </Field>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={showDevMode}
                onCheckedChange={(checked) =>
                  setShowDevMode(checked === true)
                }
              />
              Developer mode (identity, risk, raw confirm flag)
            </label>

            {showDevMode ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Risk level</FieldLabel>
                    <select
                      value={form.riskLevel || "READ"}
                      onChange={(e) =>
                        patchForm({ riskLevel: e.target.value })
                      }
                      className={cn(selectClass, "w-full")}
                    >
                      <option value="READ">READ</option>
                      <option value="WRITE">WRITE</option>
                      <option value="DESTRUCTIVE">DESTRUCTIVE</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel>Identity mode</FieldLabel>
                    <select
                      value={form.identityMode || "NONE"}
                      onChange={(e) => {
                        const identityMode = e.target.value;
                        patchForm({
                          identityMode,
                          requiresIdentity:
                            identityMode === "END_USER_TOKEN",
                        });
                      }}
                      className={cn(selectClass, "w-full")}
                    >
                      <option value="NONE">NONE — no visitor identity</option>
                      <option value="OWNER_KEY">
                        OWNER_KEY — owner credential only
                      </option>
                      <option value="END_USER_TOKEN">
                        END_USER_TOKEN — visitor setUser token
                      </option>
                    </select>
                  </Field>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(form.requiresConfirmation)}
                    onCheckedChange={(checked) =>
                      patchForm({ requiresConfirmation: checked === true })
                    }
                  />
                  Requires confirmation (studio WRITE path; embed always confirms)
                </label>
              </>
            ) : null}

            <Field>
              <FieldLabel>Inputs</FieldLabel>
              {inputs.length === 0 ? null : (
                <div className="mb-1.5 flex flex-col gap-2">
                  {inputs.map((row, idx) => (
                    <div
                      key={`in-${idx}`}
                      className="grid grid-cols-[1fr_100px_auto] gap-2"
                    >
                      <Input
                        value={row.name}
                        placeholder="variable"
                        onChange={(e) => {
                          const next = inputs.map((r, i) =>
                            i === idx ? { ...r, name: e.target.value } : r
                          );
                          setInputs(next);
                        }}
                      />
                      <select
                        value={row.type || "string"}
                        onChange={(e) => {
                          const next = inputs.map((r, i) =>
                            i === idx ? { ...r, type: e.target.value } : r
                          );
                          setInputs(next);
                        }}
                        className={selectClass}
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Remove input"
                        onClick={() =>
                          setInputs(inputs.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-fit px-0 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setInputs([...inputs, { name: "", type: "string" }])
                }
              >
                <Plus data-icon="inline-start" />
                Add input
              </Button>
              <FieldDescription>
                Variables the LLM must provide. Use them as {"{{variable}}"}{" "}
                anywhere in the request.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="http-timeout">Timeout (ms)</FieldLabel>
              <Input
                id="http-timeout"
                type="number"
                min={1000}
                max={60000}
                value={form.timeoutMs}
                onChange={(e) => patchForm({ timeoutMs: e.target.value })}
                className="max-w-[140px]"
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3 sm:justify-between">
          <div>
            {editingId && onDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive"
                disabled={saving}
                onClick={onDelete}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            ) : (
              <span />
            )}
          </div>
          <Button type="button" size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function isDemoActionUrl(url) {
  return /\/api\/demo\//i.test(String(url || ""));
}
