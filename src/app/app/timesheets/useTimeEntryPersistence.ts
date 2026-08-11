"use client";

import { useEffect, useRef } from "react";

/** Per-row save coordination. Row identity must remain the clientId. */
export function useTimeEntryPersistence() {
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const inFlightSaves = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  return { debounceTimers, inFlightSaves };
}
