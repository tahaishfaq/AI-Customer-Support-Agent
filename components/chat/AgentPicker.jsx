"use client";

export function AgentPicker({ agents, value, onChange, disabled }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
      <span className="text-xs font-medium text-[var(--color-muted)]">Agent</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || agents.length === 0}
        className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-50"
      >
        {agents.length === 0 ? (
          <option value="">No agents yet</option>
        ) : (
          agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
