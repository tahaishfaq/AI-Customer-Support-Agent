"use client";

import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateAgent } from "@/lib/api/agents";
import { MAX_PROCEDURES, proceduresSchema } from "@/lib/validations/procedures";

const STEP_TYPES = [
  { value: "ask", label: "Ask" },
  { value: "tool", label: "Tool" },
  { value: "say", label: "Say" },
  { value: "handoff", label: "Handoff" },
  { value: "end", label: "End" },
];

const FIELD_TYPES = ["text", "email", "order_id", "number", "phone"];

function newProcedureId() {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function blankStep(type = "ask") {
  switch (type) {
    case "tool":
      return { type: "tool", toolName: "", argMap: {} };
    case "say":
      return { type: "say", text: "" };
    case "handoff":
      return { type: "handoff", reason: "Customer needs a person for this procedure" };
    case "end":
      return { type: "end" };
    default:
      return {
        type: "ask",
        field: "detail",
        prompt: "What do you need help with?",
        fieldType: "text",
        required: true,
      };
  }
}

function blankProcedure() {
  return {
    id: newProcedureId(),
    name: "",
    trigger: "",
    enabled: true,
    version: 1,
    steps: [blankStep("ask"), blankStep("end")],
  };
}

function StepEditor({ step, index, onChange, onRemove, canRemove }) {
  const type = step?.type || "ask";

  function setType(nextType) {
    onChange(blankStep(nextType));
  }

  return (
    <li className="rounded-lg border border-border bg-background/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <GripVertical className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-[11px] font-medium text-muted-foreground">Step {index + 1}</span>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label={`Step ${index + 1} type`}
        >
          {STEP_TYPES.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-8"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={`Remove step ${index + 1}`}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>

      {type === "ask" ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-medium text-muted-foreground">
            Field name
            <Input
              className="mt-1 h-8"
              value={step.field || ""}
              onChange={(event) => onChange({ ...step, field: event.target.value })}
              placeholder="orderId"
            />
          </label>
          <label className="text-[11px] font-medium text-muted-foreground">
            Field type
            <select
              className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={step.fieldType || "text"}
              onChange={(event) => onChange({ ...step, fieldType: event.target.value })}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-muted-foreground sm:col-span-2">
            Prompt
            <Input
              className="mt-1 h-8"
              value={step.prompt || ""}
              onChange={(event) => onChange({ ...step, prompt: event.target.value })}
              placeholder="What is your order id?"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <Switch
              checked={step.required !== false}
              onCheckedChange={(required) => onChange({ ...step, required })}
            />
            Required
          </label>
        </div>
      ) : null}

      {type === "tool" ? (
        <div className="mt-2 grid gap-2">
          <label className="text-[11px] font-medium text-muted-foreground">
            Allowlisted tool name
            <Input
              className="mt-1 h-8"
              value={step.toolName || ""}
              onChange={(event) => onChange({ ...step, toolName: event.target.value })}
              placeholder="lookup_order"
            />
          </label>
          <label className="text-[11px] font-medium text-muted-foreground">
            Argument map (JSON object: toolArg → field)
            <Textarea
              className="mt-1 min-h-16 font-mono text-xs"
              value={JSON.stringify(step.argMap || {}, null, 2)}
              onChange={(event) => {
                try {
                  const argMap = JSON.parse(event.target.value);
                  if (argMap && typeof argMap === "object" && !Array.isArray(argMap)) {
                    onChange({ ...step, argMap });
                  }
                } catch {
                  /* keep typing */
                }
              }}
            />
          </label>
        </div>
      ) : null}

      {type === "say" ? (
        <label className="mt-2 block text-[11px] font-medium text-muted-foreground">
          Message
          <Textarea
            className="mt-1 min-h-16"
            value={step.text || ""}
            onChange={(event) => onChange({ ...step, text: event.target.value })}
            placeholder="Here is what I found."
          />
        </label>
      ) : null}

      {type === "handoff" ? (
        <label className="mt-2 block text-[11px] font-medium text-muted-foreground">
          Reason
          <Input
            className="mt-1 h-8"
            value={step.reason || ""}
            onChange={(event) => onChange({ ...step, reason: event.target.value })}
          />
        </label>
      ) : null}

      {type === "end" ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Ends the procedure on this turn.</p>
      ) : null}
    </li>
  );
}

/** Level 3 · L4 — multi-step procedures (owner authored). Tool steps still go through PEP. */
export function ProceduresEditor({ agent, onSaved }) {
  const [saved, setSaved] = useState(() => (Array.isArray(agent?.procedures) ? agent.procedures : []));
  const [procedures, setProcedures] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(procedures) !== JSON.stringify(saved);

  function patch(id, partial) {
    setProcedures((current) =>
      current.map((row) => (row.id === id ? { ...row, ...partial } : row))
    );
  }

  function patchStep(procedureId, stepIndex, nextStep) {
    setProcedures((current) =>
      current.map((row) => {
        if (row.id !== procedureId) return row;
        const steps = [...(row.steps || [])];
        steps[stepIndex] = nextStep;
        return { ...row, steps };
      })
    );
  }

  async function save() {
    const parsed = proceduresSchema.safeParse(procedures);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check the procedures");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateAgent(agent.id, { procedures: parsed.data });
      const stored = Array.isArray(updated?.procedures) ? updated.procedures : parsed.data;
      setProcedures(stored);
      setSaved(stored);
      onSaved?.(updated);
      toast.success("Procedures saved");
    } catch (err) {
      setError(err.message || "Could not save procedures");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="aide-card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="procedures-heading">
      <div className="flex flex-col gap-1">
        <h2 id="procedures-heading" className="text-base font-semibold text-foreground">
          Procedures
        </h2>
        <p className="text-xs text-muted-foreground">
          Multi-step workflows (ask → tool → say / handoff). Tools still need confirmation and policy
          checks. Up to {MAX_PROCEDURES} procedures; first matching trigger wins.
        </p>
      </div>

      {procedures.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No procedures yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {procedures.map((row, index) => (
            <li key={row.id} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={row.name}
                  maxLength={80}
                  onChange={(event) => patch(row.id, { name: event.target.value })}
                  placeholder={`Procedure ${index + 1} name`}
                  className="h-9"
                />
                <Switch
                  checked={row.enabled !== false}
                  onCheckedChange={(enabled) => patch(row.id, { enabled })}
                  aria-label={`Procedure ${index + 1} enabled`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setProcedures((current) => current.filter((item) => item.id !== row.id))
                  }
                  aria-label={`Delete procedure ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
              <label className="mt-2 block text-[11px] font-medium text-muted-foreground">
                Trigger (customer wording)
                <Input
                  className="mt-1 h-9"
                  value={row.trigger}
                  maxLength={300}
                  onChange={(event) => patch(row.id, { trigger: event.target.value })}
                  placeholder="refund status"
                />
              </label>
              <div className="mt-3">
                <p className="text-[11px] font-medium text-muted-foreground">Steps</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {(row.steps || []).map((step, stepIndex) => (
                    <StepEditor
                      key={`${row.id}-${stepIndex}`}
                      step={step}
                      index={stepIndex}
                      canRemove={(row.steps || []).length > 1}
                      onChange={(next) => patchStep(row.id, stepIndex, next)}
                      onRemove={() =>
                        patch(
                          row.id,
                          {
                            steps: (row.steps || []).filter((_, i) => i !== stepIndex),
                          }
                        )
                      }
                    />
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={(row.steps || []).length >= 30}
                  onClick={() =>
                    patch(row.id, { steps: [...(row.steps || []), blankStep("say")] })
                  }
                >
                  <Plus className="size-3.5" />
                  Add step
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={procedures.length >= MAX_PROCEDURES}
          onClick={() => setProcedures((current) => [...current, blankProcedure()])}
        >
          <Plus className="size-3.5" />
          Add procedure
        </Button>
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save procedures"}
        </Button>
      </div>
    </section>
  );
}
