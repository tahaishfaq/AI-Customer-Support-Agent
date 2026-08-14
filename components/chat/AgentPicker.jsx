"use client";

export function AgentPicker({ agents, value, onChange, disabled }) {
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Agent</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || agents.length === 0}
        aria-label="Agent"
        className="h-8 max-w-[16rem] truncate rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[13px] font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-50"
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
