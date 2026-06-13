"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type NavigationContextValue = {
  optimisticPath: string | null;
  setOptimisticPath: (path: string) => void;
  startNavigation: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return ctx;
}

function NavigationProgressBar({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed left-0 right-0 top-0 z-[9999] h-0.5 origin-left bg-[var(--accent-mid)]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          onAnimationComplete={onComplete}
        />
      )}
    </AnimatePresence>
  );
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const [progressActive, setProgressActive] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearProgress = useCallback(() => {
    setProgressActive(false);
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startNavigation = useCallback(() => {
    setProgressActive(true);
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    // Safety net if navigation aborts or animation callback never fires.
    progressTimerRef.current = setTimeout(clearProgress, 4000);
  }, [clearProgress]);

  useEffect(() => {
    setOptimisticPath(null);
    clearProgress();
  }, [pathname, clearProgress]);

  useEffect(
    () => () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    },
    [],
  );

  return (
    <NavigationContext.Provider
      value={{ optimisticPath, setOptimisticPath, startNavigation }}
    >
      <NavigationProgressBar active={progressActive} onComplete={clearProgress} />
      {children}
    </NavigationContext.Provider>
  );
}
