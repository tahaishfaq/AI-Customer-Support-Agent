"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const fieldClass =
  "h-12 w-full rounded-xl border border-[#e2e8f0] bg-white py-2 pl-4 pr-11 text-[15px] text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-60";

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete = "current-password",
  disabled = false,
  required = false,
  minLength,
  placeholder,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        disabled={disabled}
        className={fieldClass}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        disabled={disabled}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-[#64748b] transition hover:text-[#0f172a] disabled:opacity-50"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
    </div>
  );
}
