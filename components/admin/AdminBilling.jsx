"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAdminBillingPlans,
  updateAdminBillingPlan,
} from "@/lib/api/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Badge } from "@/components/ui/badge";
import {
  BASIC_PLAN_NAME,
  formatPlanPriceLabel,
  isPlanComingSoon,
} from "@/lib/billing/plan-labels";
import { DEFAULT_BILLING_PLANS } from "@/lib/billing/constants";

function formatPrice(plan) {
  if (plan.planType === "CUSTOM") return "Contact us";
  return formatPlanPriceLabel(plan);
}

function recommendedSeed(planType) {
  return DEFAULT_BILLING_PLANS.find((p) => p.planType === planType) || null;
}

function PlanEditor({ plan, onSaved }) {
  const [draft, setDraft] = useState({
    name: plan.name,
    description: plan.description || "",
    priceMinor: plan.priceMinor,
    safepayPlanId: plan.safepayPlanId || "",
    maxWorkspaces: plan.maxWorkspaces,
    maxAgentsPerWorkspace: plan.maxAgentsPerWorkspace,
    maxConversationsPerMonth: plan.maxConversationsPerMonth,
    featuresText: (plan.featuresJson || plan.features || []).join("\n"),
    isActive: plan.isActive,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft({
      name: plan.name,
      description: plan.description || "",
      priceMinor: plan.priceMinor,
      safepayPlanId: plan.safepayPlanId || "",
      maxWorkspaces: plan.maxWorkspaces,
      maxAgentsPerWorkspace: plan.maxAgentsPerWorkspace,
      maxConversationsPerMonth: plan.maxConversationsPerMonth ?? 0,
      featuresText: (plan.featuresJson || plan.features || []).join("\n"),
      isActive: plan.isActive,
    });
  }, [plan]);

  async function applyRecommended() {
    const seed = recommendedSeed(plan.planType);
    if (!seed) return;
    setDraft((d) => ({
      ...d,
      name: seed.name,
      description: seed.description || "",
      priceMinor: seed.priceMinor,
      maxWorkspaces: seed.maxWorkspaces,
      maxAgentsPerWorkspace: seed.maxAgentsPerWorkspace,
      maxConversationsPerMonth: seed.maxConversationsPerMonth,
      featuresText: (seed.featuresJson || []).join("\n"),
      isActive: seed.isActive,
    }));
    toast.message("Draft filled with recommended defaults — click Save slot to apply live");
  }

  async function save() {
    setBusy(true);
    try {
      const featuresJson = draft.featuresText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const updated = await updateAdminBillingPlan(plan.id, {
        name: draft.name,
        description: draft.description || null,
        priceMinor: Number(draft.priceMinor) || 0,
        safepayPlanId: draft.safepayPlanId.trim() || null,
        maxWorkspaces: Number(draft.maxWorkspaces) || 0,
        maxAgentsPerWorkspace: Number(draft.maxAgentsPerWorkspace) || 0,
        maxConversationsPerMonth: Number(draft.maxConversationsPerMonth) || 0,
        featuresJson,
        isActive: draft.isActive,
      });
      const n = updated.subscriberCount ?? 0;
      toast.success(
        n > 0
          ? `${plan.planType} saved — live for ${n} subscriber${n === 1 ? "" : "s"}`
          : `${plan.planType} plan saved — live for all future subscribers`
      );
      onSaved(updated);
    } catch (err) {
      toast.error(err.message || "Unable to save plan");
    } finally {
      setBusy(false);
    }
  }

  const isPaid = plan.planType === "POPULAR" || plan.planType === "TEAMS";
  const subscribers = plan.subscriberCount ?? 0;

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">{plan.planType}</h2>
          <Badge variant="secondary" className="text-[10px] uppercase">
            {plan.slug}
          </Badge>
          {plan.isPopular ? (
            <Badge className="text-[10px]">Popular badge</Badge>
          ) : null}
          {isPlanComingSoon(plan) ? (
            <Badge variant="outline" className="text-[10px]">
              Coming soon (checkout off)
            </Badge>
          ) : null}
          {!plan.isActive ? (
            <Badge variant="outline" className="text-[10px]">
              Inactive
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {subscribers} live subscriber{subscribers === 1 ? "" : "s"}
          </Badge>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {formatPrice(plan)} / {plan.interval?.toLowerCase() || "month"}
        </span>
      </div>

      <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-[12px] text-muted-foreground">
        Saving updates this slot for everyone on it right away — caps, price
        labels, and feature bullets are read live from this plan (not frozen per
        user). Users already over a lowered cap keep existing resources but
        cannot create more until they delete or upgrade.
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${plan.id}-name`}>Display name</Label>
          <Input
            id={`${plan.id}-name`}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${plan.id}-price`}>Price (PKR)</Label>
          <Input
            id={`${plan.id}-price`}
            type="number"
            min={0}
            disabled={plan.planType === "CUSTOM"}
            value={draft.priceMinor}
            onChange={(e) =>
              setDraft((d) => ({ ...d, priceMinor: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${plan.id}-description`}>Short description</Label>
          <Input
            id={`${plan.id}-description`}
            value={draft.description}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
          />
        </div>
        {isPaid ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${plan.id}-safepay`}>SafePay plan id</Label>
            <Input
              id={`${plan.id}-safepay`}
              placeholder="plan_…"
              value={draft.safepayPlanId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, safepayPlanId: e.target.value }))
              }
            />
          </div>
        ) : null}
        {plan.planType !== "CUSTOM" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor={`${plan.id}-workspaces`}>Max workspaces (0 = unlimited)</Label>
              <Input
                id={`${plan.id}-workspaces`}
                type="number"
                min={0}
                value={draft.maxWorkspaces}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, maxWorkspaces: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${plan.id}-agents`}>Max agents / workspace (0 = unlimited)</Label>
              <Input
                id={`${plan.id}-agents`}
                type="number"
                min={0}
                value={draft.maxAgentsPerWorkspace}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxAgentsPerWorkspace: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${plan.id}-conversations`}>
                Billable conversations / month (0 = unlimited)
              </Label>
              <Input
                id={`${plan.id}-conversations`}
                type="number"
                min={0}
                value={draft.maxConversationsPerMonth}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxConversationsPerMonth: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Botpress-style: counts when a chat has 2+ visitor messages in the
                calendar month.
              </p>
            </div>
          </>
        ) : (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${plan.id}-workspaces`}>Max workspaces (0 = unlimited)</Label>
              <Input
                id={`${plan.id}-workspaces`}
                type="number"
                min={0}
                value={draft.maxWorkspaces}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, maxWorkspaces: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${plan.id}-agents`}>Max agents / workspace (0 = unlimited)</Label>
              <Input
                id={`${plan.id}-agents`}
                type="number"
                min={0}
                value={draft.maxAgentsPerWorkspace}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxAgentsPerWorkspace: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${plan.id}-conversations`}>
                Conversation cap (0 = unlimited until negotiated)
              </Label>
              <Input
                id={`${plan.id}-conversations`}
                type="number"
                min={0}
                value={draft.maxConversationsPerMonth}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxConversationsPerMonth: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Custom is sales-led — set negotiated limits here when you convert
                a request. Changes apply to every user on this Custom slot.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${plan.id}-features`}>Feature bullets (one per line)</Label>
          <Textarea
            id={`${plan.id}-features`}
            rows={5}
            value={draft.featuresText}
            onChange={(e) =>
              setDraft((d) => ({ ...d, featuresText: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Landing, onboarding, and compare plans read these bullets + the
            numeric limits above after you save.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) =>
              setDraft((d) => ({ ...d, isActive: e.target.checked }))
            }
            className="size-4 rounded border-border"
          />
          Show on public pricing catalog
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={applyRecommended}
        >
          Fill recommended
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save slot"}
        </Button>
      </div>
    </section>
  );
}

export function AdminBilling() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminBillingPlans();
      setPlans(data);
    } catch (err) {
      setError(err.message || "Unable to load billing plans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onPlanSaved(updated) {
    setPlans((prev) =>
      prev.map((plan) => (plan.id === updated.id ? updated : plan))
    );
  }

  return (
    <main className="aide-page">
      <PageHeader
        title="Billing plans"
        description={`Four fixed slots — ${BASIC_PLAN_NAME}, Popular, Teams, and Custom. Edit limits and copy once; every subscriber on that slot gets the new access on their next request.`}
      />

      <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
        <p className="font-medium text-foreground">Live entitlements</p>
        <p className="mt-1">
          Caps are stored on the plan, not copied onto each user. When you change
          workspaces, agents, conversations, price, or feature bullets, ACTIVE and
          PAST_DUE subscribers on that plan pick them up immediately. Recommended
          ladder: Basic 100/1ws/3 agents · Popular 250/3ws/unlimited agents · Teams
          1,500/10ws/unlimited · Custom negotiated.
        </p>
      </div>

      {error ? (
        <InlineAlert title="Couldn’t load plans" className="mt-4">
          {error}
        </InlineAlert>
      ) : null}

      <div className="mt-6 grid gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))
          : plans.map((plan) => (
              <PlanEditor key={plan.id} plan={plan} onSaved={onPlanSaved} />
            ))}
      </div>

      {!loading && plans.length === 4 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Popular badge is shown only on the Popular slot. Paid checkout requires
          SafePay plan ids on Popular and Teams. Seed no longer overwrites your
          edits — only creates missing slots.
        </p>
      ) : null}
    </main>
  );
}
