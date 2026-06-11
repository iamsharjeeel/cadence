"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
          className="fixed left-0 right-0 top-0 z-[9999] h-0.5 origin-left bg-[var(--accent)]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          onAnimationComplete={(definition) => {
            if (definition === "animate") onComplete();
          }}
        />
      )}
    </AnimatePresence>
  );
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const [progressActive, setProgressActive] = useState(false);

  const startNavigation = useCallback(() => {
    setProgressActive(true);
  }, []);

  useEffect(() => {
    setOptimisticPath(null);
    setProgressActive(false);
  }, [pathname]);

  return (
    <NavigationContext.Provider
      value={{ optimisticPath, setOptimisticPath, startNavigation }}
    >
      <NavigationProgressBar
        active={progressActive}
        onComplete={() => setProgressActive(false)}
      />
      {children}
    </NavigationContext.Provider>
  );
}
