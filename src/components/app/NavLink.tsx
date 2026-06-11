"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { useNavigation } from "@/components/app/NavigationProvider";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  className,
  activeClassName,
  inactiveClassName,
  onClick,
  children,
  ...props
}: {
  href: string;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  onClick?: () => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "onClick">) {
  const pathname = usePathname();
  const { optimisticPath, setOptimisticPath, startNavigation } = useNavigation();
  const active = (optimisticPath ?? pathname) === href;

  return (
    <motion.div whileHover={{ x: 2 }} transition={{ duration: 0.08 }}>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          if (href !== pathname) {
            setOptimisticPath(href);
            startNavigation();
          }
          onClick?.();
        }}
        className={cn(
          className,
          active ? activeClassName : inactiveClassName,
        )}
        {...props}
      >
        {children}
      </Link>
    </motion.div>
  );
}
