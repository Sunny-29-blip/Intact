"use client";

import { useState, useRef } from "react";

interface PasswordFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  autoComplete?: "new-password" | "current-password";
  disabled?: boolean;
  required?: boolean;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder = "••••••••",
  autoComplete = "current-password",
  disabled = false,
  required = false,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleVisibility = () => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      setShow((prev) => !prev);
      requestAnimationFrame(() => {
        if (input) {
          input.focus();
          if (start !== null && end !== null) {
            input.setSelectionRange(start, end);
          }
        }
      });
    } else {
      setShow((prev) => !prev);
    }
  };

  const inputId = id || `password-field-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className="block text-[11px] font-mono font-medium text-ink-700 uppercase tracking-wider mb-1"
      >
        {label} {required && <span className="text-damage">*</span>}
      </label>

      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={inputId}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`w-full pl-3 pr-12 py-2 text-xs border bg-page focus:bg-surface focus:outline-none transition-colors ${
            error
              ? "border-damage focus:border-damage"
              : "border-ink-200 focus:border-accent"
          }`}
        />

        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-0 top-0 bottom-0 min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center text-[10px] font-mono text-ink-500 hover:text-ink-900 uppercase font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      {error ? (
        <p className="text-[11px] text-damage mt-1 font-mono">{error}</p>
      ) : hint ? (
        <p className="text-[10px] font-mono text-ink-500 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
