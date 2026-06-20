import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

const fieldBase =
  "h-9 w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-all focus-visible:outline-none focus-visible:border-transparent focus-visible:shadow-[0_0_0_2px_var(--accent-soft),0_0_0_1px_var(--accent)] disabled:opacity-60 dark:rounded-none dark:border-0 dark:border-b dark:border-[var(--line)] dark:bg-transparent dark:shadow-none dark:focus-visible:border-[var(--accent)] dark:focus-visible:shadow-none";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(fieldBase, className)}
          {...props}
        />
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

export { fieldBase };
