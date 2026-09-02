"use client";

import { useMemo, useState } from "react";
import { Building2, Plus, Sparkles } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { installActionPack } from "@/lib/api/credentials";
import {
  CUSTOM_SLOT_STARTERS,
  UNIVERSAL_BUSINESSES,
  UNIVERSAL_VERTICALS,
  filterUniversalBusinesses,
  universalPackId,
} from "@/lib/integrations/universal-businesses";
import { applyAccessClass } from "@/lib/actions/access-class";
import { cn } from "@/lib/utils";

/**
 * F11-U Sprint A — pick a business vertical → install suggested demo tools.
 */
export function UniversalBusinessWizard({
  agentId,
  credentialId = null,
  onInstalled,
  onOpenSlot,
}) {
  const [vertical, setVertical] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const businesses = useMemo(
    () => filterUniversalBusinesses(vertical),
    [vertical]
  );
  const selected = useMemo(
    () => UNIVERSAL_BUSINESSES.find((b) => b.id === selectedId) || null,
    [selectedId]
  );

  async function handleInstall(business) {
    if (!agentId || !business?.id) return;
    setBusyId(business.id);
    try {
      const result = await installActionPack(
        agentId,
        universalPackId(business.id),
        { credentialId: credentialId || undefined }
      );
      const n = result?.created?.length || 0;
      const skipped = result?.skipped?.length || 0;
      toast.success(
        n
          ? `Installed ${n} starter tool${n === 1 ? "" : "s"} for ${business.name}`
          : skipped
            ? "Tools already installed (skipped duplicates)"
            : "Nothing to install"
      );
      onInstalled?.(result);
    } catch (err) {
      toast.error(err.message || "Unable to install tools");
    } finally {
      setBusyId(null);
    }
  }

  function openCustomSlot(slot) {
    const access = applyAccessClass(slot.accessClass) || {};
    onOpenSlot?.({
      name: slot.name,
      description: slot.description,
      method: slot.method,
      urlTemplate: slot.urlTemplate,
      headersJsonText: JSON.stringify(
        slot.method === "POST"
          ? {
              Accept: "application/json",
              "Content-Type": "application/json",
            }
          : { Accept: "application/json" },
        null,
        2
      ),
      inputSchemaJson: slot.inputSchemaJson || {},
      inputSchemaJsonText: JSON.stringify(slot.inputSchemaJson || {}, null, 2),
      enabled: true,
      timeoutMs: 8000,
      credentialId: credentialId || "",
      testArgsText: JSON.stringify(slot.testArgs || {}, null, 2),
      ...access,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Business templates</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick a vertical → install 4 demo-backed tools (public, guest lookup,
          signed-in read, write). Point URLs at your API next. Same security
          spine for every business.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {UNIVERSAL_VERTICALS.map((v) => (
          <Button
            key={v.id}
            type="button"
            size="sm"
            variant={vertical === v.id ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setVertical(v.id)}
          >
            {v.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {businesses.map((biz) => {
          const active = selectedId === biz.id;
          return (
            <Card
              key={biz.id}
              size="sm"
              className={cn(
                "cursor-pointer transition-shadow",
                active && "ring-1 ring-primary/30"
              )}
              onClick={() => setSelectedId(biz.id)}
            >
              <CardHeader className="gap-1">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {biz.vertical}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {biz.id}
                  </span>
                </div>
                <CardTitle className="text-sm">{biz.name}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">
                  Embed: {biz.embed}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Guest: {biz.guestTools.slice(0, 2).join(", ")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Account: {biz.accountTools.slice(0, 2).join(", ")}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={busyId === biz.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInstall(biz);
                  }}
                >
                  {busyId === biz.id ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Sparkles data-icon="inline-start" />
                  )}
                  Install suggested tools
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {selected ? (
        <Card size="sm" className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">{selected.name}</CardTitle>
            <CardDescription className="text-xs">
              Top asks: {selected.supportUseCases.join(" · ")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="border-t border-border pt-4">
        <p className="text-sm font-semibold">Custom business (5 slots)</p>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          No matching vertical? Add one slot at a time — still the same
          universal policy.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOM_SLOT_STARTERS.map((slot) => (
            <Button
              key={slot.id}
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => openCustomSlot(slot)}
            >
              <Plus data-icon="inline-start" />
              {slot.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
