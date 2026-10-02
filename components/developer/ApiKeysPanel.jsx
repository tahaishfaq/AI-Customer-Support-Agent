"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatRelative } from "@/components/conversations/format";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api/developer";
import { SecretOnceDialog } from "@/components/developer/SecretOnceDialog";

const KEYS_QUERY = ["developer", "api-keys"];

/** Level 2 · P7 — read-only REST API keys for this workspace. */
export function ApiKeysPanel() {
  const queryClient = useQueryClient();
  const keysQuery = useQuery({ queryKey: KEYS_QUERY, queryFn: listApiKeys });
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [newSecret, setNewSecret] = useState(null);
  const [revoking, setRevoking] = useState(null);

  async function create(event) {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const result = await createApiKey(name.trim());
      setNewSecret(result.secret);
      setName("");
      await queryClient.invalidateQueries({ queryKey: KEYS_QUERY });
    } catch (err) {
      setError(err.message || "Could not create the key");
    } finally {
      setCreating(false);
    }
  }

  const keys = keysQuery.data?.keys || [];

  return (
    <section className="aide-card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="api-keys-heading">
      <div>
        <h2 id="api-keys-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <KeyRound className="size-4" aria-hidden /> API keys
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Read your agents, conversations and messages from your own systems. Send{" "}
          <code className="font-mono">Authorization: Bearer &lt;key&gt;</code> to <code className="font-mono">/api/v1/…</code>.
          Keys are read-only.
        </p>
      </div>

      <form onSubmit={create} className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Key name, e.g. CRM sync"
          aria-label="New key name"
          className="h-9 min-w-0 flex-1 sm:max-w-xs"
        />
        <Button type="submit" size="sm" disabled={!name.trim() || creating}>
          {creating ? <Spinner data-icon="inline-start" /> : null} Create key
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {keysQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading keys…
        </p>
      ) : keysQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {keysQuery.error?.message || "Could not load keys"}
        </p>
      ) : keys.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No keys yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {key.name}
                  {key.revokedAt ? (
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      Revoked
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  <code className="font-mono">{key.masked}</code> · created {formatRelative(key.createdAt)} ·{" "}
                  {key.lastUsedAt ? `last used ${formatRelative(key.lastUsedAt)}` : "never used"}
                </p>
              </div>
              {!key.revokedAt ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setRevoking(key)}>
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <SecretOnceDialog
        secret={newSecret}
        title="Your new API key"
        description="Use it as a Bearer token. Anyone with this key can read this workspace's conversations."
        onClose={() => setNewSecret(null)}
      />
      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revoke “${revoking?.name || ""}”?`}
        description="Requests using this key stop working immediately. This cannot be undone."
        confirmLabel="Revoke key"
        onConfirm={async () => {
          await revokeApiKey(revoking.id);
          await queryClient.invalidateQueries({ queryKey: KEYS_QUERY });
        }}
      />
    </section>
  );
}
