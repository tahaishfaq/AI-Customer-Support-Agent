"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete = "current-password",
  disabled = false,
  required = false,
  minLength,
  placeholder,
  className,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("h-11 pr-11", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        onPointerDown={(event) => {
          // Keep focus on the input — avoids laggy focus steal + keyboard flicker.
          event.preventDefault();
          if (disabled) return;
          setVisible((prev) => !prev);
        }}
      >
        {visible ? (
          <Eye className="size-4" strokeWidth={1.75} />
        ) : (
          <EyeOff className="size-4" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
