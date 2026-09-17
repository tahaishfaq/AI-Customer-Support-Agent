"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FormSection } from "@/components/customization/CustomizationFields";
import {
  createAgentCredential,
  rotateAgentCredential,
  revokeAgentCredential,
} from "@/lib/api/credentials";
import { createAgentConnection, probeAgentConnection } from "@/lib/api/connections";
import { Badge } from "@/components/ui/badge";
import { updateAgentAction } from "@/lib/api/actions";
import {
  assertOwnerCredentialSafe,
  buildShopifyAdminConnectPlan,
  credentialPayloadHasPlaintext,
} from "@/lib/integrations/connection-wizard";
import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/integrations/connectors";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Connection + API-key wizard.
 * Secrets go only to ActionCredential create/rotate; connections store credentialId refs.
 */
export function ConnectionWizard({
  agentId,
  credentials = [],
  connections = [],
  actions = [],
  onChanged,
}) {
  const activeCreds = credentials.filter((c) => !c.revokedAt);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionForm, setConnectionForm] = useState({
    name: "",
    baseOrigin: "",
    environment: "sandbox",
    credentialId: "",
  });
  const [shopifyBusy, setShopifyBusy] = useState(false);
  const [shopifyForm, setShopifyForm] = useState({
    shop: "",
    secret: "",
    environment: "sandbox",
  });
  const [rotateId, setRotateId] = useState(null);
  const [rotateSecret, setRotateSecret] = useState("");
  const [rotateBusy, setRotateBusy] = useState(false);
  const [probeBusyId, setProbeBusyId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  function guardCredentialResponse(payload) {
    if (credentialPayloadHasPlaintext(payload)) {
      throw new Error("Server returned a secret — refused to keep it in the browser");
    }
    return assertOwnerCredentialSafe(payload);
  }

  async function handleCreateConnection() {
    setConnectionBusy(true);
    try {
      await createAgentConnection(agentId, {
        name: connectionForm.name,
        baseOrigin: connectionForm.baseOrigin,
        environment: connectionForm.environment,
        credentialId: connectionForm.credentialId || null,
      });
      toast.success("Connected system saved (credential reference only)");
      setConnectionForm({
        name: "",
        baseOrigin: "",
        environment: "sandbox",
        credentialId: "",
      });
      await onChanged?.();
    } catch (err) {
      toast.error(err.message || "Unable to save connected system");
    } finally {
      setConnectionBusy(false);
    }
  }

  async function handleShopifyConnect() {
    if (!agentId) return;
    setShopifyBusy(true);
    try {
      const plan = buildShopifyAdminConnectPlan({
        shop: shopifyForm.shop,
        environment: shopifyForm.environment,
      });
      const secret = String(shopifyForm.secret || "").trim();
      if (!secret) {
        toast.error("Paste the Admin API access token");
        return;
      }

      const credential = guardCredentialResponse(
        await createAgentCredential(agentId, {
          ...plan.credential,
          secret,
        })
      );

      const connection = await createAgentConnection(agentId, {
        ...plan.connection,
        credentialId: credential.id,
      });

      const targets = (actions || []).filter((a) =>
        plan.actionNames.includes(a.name)
      );
      const orderUrl = `${plan.connection.baseOrigin}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/orders/{{orderId}}.json`;
      for (const action of targets) {
        await updateAgentAction(agentId, action.id, {
          connectionId: connection.id,
          credentialId: credential.id,
          urlTemplate: orderUrl,
        });
      }

      toast.success(
        targets.length
          ? `Shopify Admin connected — ${targets.length} tool${targets.length === 1 ? "" : "s"} linked`
          : "Shopify Admin connected — install the Shopify template tools to use it"
      );
      setShopifyForm({ shop: "", secret: "", environment: "sandbox" });
      await onChanged?.();
    } catch (err) {
      toast.error(err.message || "Unable to connect Shopify Admin");
    } finally {
      setShopifyBusy(false);
    }
  }

  async function handleProbeConnection(connection) {
    if (!agentId || !connection?.id) return;
    setProbeBusyId(connection.id);
    try {
      const result = await probeAgentConnection(agentId, connection.id, {});
      if (result?.ok) {
        toast.success(
          `${connection.name}: verified (host reachable${
            connection.currentRevision?.credentialId ? " with credential" : ""
          })`
        );
      } else {
        toast.error(
          result?.errorCode
            ? `${connection.name}: probe failed (${result.errorCode})`
            : `${connection.name}: probe failed`
        );
      }
      await onChanged?.();
    } catch (err) {
      toast.error(err.message || "Unable to probe connection");
    } finally {
      setProbeBusyId(null);
    }
  }

  async function handleRotate(cred) {
    const secret = String(rotateSecret || "").trim();
    if (!secret) {
      toast.error("Paste the new secret to rotate");
      return;
    }
    setRotateBusy(true);
    try {
      guardCredentialResponse(
        await rotateAgentCredential(agentId, cred.id, secret)
      );
      toast.success("Credential rotated");
      setRotateId(null);
      setRotateSecret("");
      await onChanged?.();
    } catch (err) {
      toast.error(err.message || "Unable to rotate credential");
    } finally {
      setRotateBusy(false);
    }
  }

  async function handleRevoke(cred) {
    setConfirmState({
      title: "Revoke this API key?",
      description:
        "Tools and connections using this key will detach. You can’t undo revoke — paste a fresh key to reconnect.",
      confirmLabel: "Revoke key",
      onConfirm: async () => {
        try {
          guardCredentialResponse(
            await revokeAgentCredential(agentId, cred.id)
          );
          toast.success("API key revoked");
          if (rotateId === cred.id) {
            setRotateId(null);
            setRotateSecret("");
          }
          await onChanged?.();
        } catch (err) {
          toast.error(err.message || "Unable to revoke key");
          throw err;
        }
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={confirmState?.onConfirm}
      />
      <FormSection title="Shopify Admin (API key)">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">
            Paste a custom app Admin API access token once. Aide stores it as an
            encrypted credential and links the connection by id only — the token
            is never shown again and never returned by the API.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium">
              Shop
              <Input
                value={shopifyForm.shop}
                onChange={(e) =>
                  setShopifyForm((p) => ({ ...p, shop: e.target.value }))
                }
                placeholder="acme or acme.myshopify.com"
                disabled={shopifyBusy}
                autoComplete="off"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium">
              Environment
              <select
                value={shopifyForm.environment}
                onChange={(e) =>
                  setShopifyForm((p) => ({ ...p, environment: e.target.value }))
                }
                className="flex h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={shopifyBusy}
                aria-label="Shopify environment"
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">
              Admin API access token
              <Input
                type="password"
                value={shopifyForm.secret}
                onChange={(e) =>
                  setShopifyForm((p) => ({ ...p, secret: e.target.value }))
                }
                placeholder="shpat_…"
                disabled={shopifyBusy}
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              onClick={handleShopifyConnect}
              disabled={
                shopifyBusy ||
                !shopifyForm.shop.trim() ||
                !shopifyForm.secret.trim()
              }
            >
              {shopifyBusy ? <Spinner data-icon="inline-start" /> : null}
              Connect Shopify Admin
            </Button>
          </div>
        </div>
      </FormSection>

      <FormSection title="Connected systems">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">
            Save an API origin once and attach an existing credential by
            reference. Secrets are not stored on the connection.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              value={connectionForm.name}
              onChange={(e) =>
                setConnectionForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="brandly_api"
              aria-label="Connected system name"
              disabled={connectionBusy}
            />
            <select
              value={connectionForm.environment}
              onChange={(e) =>
                setConnectionForm((p) => ({ ...p, environment: e.target.value }))
              }
              className="flex h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Connected system environment"
              disabled={connectionBusy}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
            <Input
              value={connectionForm.baseOrigin}
              onChange={(e) =>
                setConnectionForm((p) => ({ ...p, baseOrigin: e.target.value }))
              }
              placeholder="https://api.example.com"
              aria-label="Connected system base origin"
              disabled={connectionBusy}
              className="sm:col-span-2"
            />
            <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">
              Credential (optional)
              <select
                value={connectionForm.credentialId}
                onChange={(e) =>
                  setConnectionForm((p) => ({
                    ...p,
                    credentialId: e.target.value,
                  }))
                }
                className="flex h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={connectionBusy}
                aria-label="Connection credential"
              >
                <option value="">No credential</option>
                {activeCreds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.hasSecret ? "" : " (empty)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              onClick={handleCreateConnection}
              disabled={
                connectionBusy ||
                !connectionForm.name.trim() ||
                !connectionForm.baseOrigin.trim()
              }
            >
              {connectionBusy ? <Spinner data-icon="inline-start" /> : null}
              Save system
            </Button>
          </div>
          {connections.length ? (
            <ul className="mt-4 space-y-2 border-t border-border pt-3">
              {connections.map((connection) => {
                const verified =
                  connection.liveConnected ||
                  connection.verificationStatus === "verified" ||
                  Boolean(connection.currentRevision?.healthVerifiedAt);
                const probing = probeBusyId === connection.id;
                return (
                  <li
                    key={connection.id}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span className="font-medium">{connection.name}</span>
                    <Badge
                      variant={verified ? "default" : "secondary"}
                      className="h-5 px-1.5 text-[10px] font-normal"
                    >
                      {verified ? "Verified" : "Not verified"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {connection.environment}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                      {connection.currentRevision?.baseOrigin || "No origin"}
                    </span>
                    <span className="text-muted-foreground">
                      {connection.currentRevision?.credentialId
                        ? "Credential linked"
                        : "No credential"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={probing}
                      onClick={() => handleProbeConnection(connection)}
                    >
                      {probing ? <Spinner data-icon="inline-start" /> : null}
                      Test connection
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Credential rotate / revoke">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">
            Rotate replaces the encrypted secret in place. Revoke detaches tools
            and connection refs. Plaintext is never listed.
          </p>
          {activeCreds.length ? (
            <div className="mt-3 space-y-2">
              {activeCreds.map((credential) => (
                <div
                  key={credential.id}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {credential.name}
                    </span>
                    <span className="text-muted-foreground">
                      v{credential.keyVersion}
                      {credential.type === "API_KEY_HEADER"
                        ? ` · ${credential.headerName || "API key"}`
                        : " · Bearer"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        setRotateId(
                          rotateId === credential.id ? null : credential.id
                        );
                        setRotateSecret("");
                      }}
                    >
                      Rotate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-destructive"
                      onClick={() => handleRevoke(credential)}
                    >
                      Revoke
                    </Button>
                  </div>
                  {rotateId === credential.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        type="password"
                        value={rotateSecret}
                        onChange={(e) => setRotateSecret(e.target.value)}
                        placeholder="New secret"
                        className="max-w-sm"
                        autoComplete="new-password"
                        disabled={rotateBusy}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={rotateBusy || !rotateSecret.trim()}
                        onClick={() => handleRotate(credential)}
                      >
                        {rotateBusy ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        Save new secret
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No active credentials yet — save one under HTTP tools, or connect
              Shopify above.
            </p>
          )}
        </div>
      </FormSection>
    </div>
  );
}
