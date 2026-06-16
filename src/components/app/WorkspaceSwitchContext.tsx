"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type WorkspaceSwitchContextValue = {
  beginSwitch: (label?: string) => void;
  endSwitch: () => void;
};

const WorkspaceSwitchContext =
  createContext<WorkspaceSwitchContextValue | null>(null);

export function useWorkspaceSwitch() {
  const ctx = useContext(WorkspaceSwitchContext);
  if (!ctx) {
    throw new Error("useWorkspaceSwitch must be used within WorkspaceSwitchProvider");
  }
  return ctx;
}

export function WorkspaceSwitchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("Switching workspace…");

  const beginSwitch = useCallback((nextLabel?: string) => {
    setLabel(nextLabel ?? "Switching workspace…");
    setActive(true);
  }, []);

  const endSwitch = useCallback(() => setActive(false), []);

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  return (
    <WorkspaceSwitchContext.Provider value={{ beginSwitch, endSwitch }}>
      {children}
      {active ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-surface px-8 py-7 shadow-float">
            <svg
              className="h-8 w-8 animate-spin text-[var(--accent)]"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4z"
              />
            </svg>
            <p className="font-display text-sm font-semibold tracking-tight text-ink">
              {label}
            </p>
          </div>
        </div>
      ) : null}
    </WorkspaceSwitchContext.Provider>
  );
}
