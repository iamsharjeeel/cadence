"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";

interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, hint, className, id, name, ...props }, ref) => {
    const inputId = id ?? name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          name={name}
          type="date"
          className={cn(
            // Layout
            "h-10 w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]",
            "px-3 py-2 text-sm text-ink",
            // Typography — Space Grotesk for the date value
            "font-[var(--font-space-grotesk)] tabular-nums",
            // Focus ring — teal accent
            "outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]",
            // Placeholder / empty state
            "placeholder:text-muted",
            // Calendar icon — honour OS color scheme
            "[color-scheme:light] dark:[color-scheme:dark]",
            // Transition
            "transition-colors duration-100",
            // Disabled
            "disabled:opacity-60",
            // Error state
            error && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger-soft)]",
            className,
          )}
          {...props}
        />
        {hint && <p className="text-xs text-muted">{hint}</p>}
        {error && (
          <p className="text-xs text-[var(--danger)]">{error}</p>
        )}
      </div>
    );
  }
);
DatePicker.displayName = "DatePicker";
