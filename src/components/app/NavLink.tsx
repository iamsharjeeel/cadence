"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { useNavigation } from "@/components/app/NavigationProvider";
import { matchNavHref } from "@/components/app/nav";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  className,
  activeClassName,
  inactiveClassName,
  onClick,
  allNavHrefs,
  children,
  ...props
}: {
  href: string;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  onClick?: () => void;
  /** All nav hrefs in the current sidebar — enables longest-prefix active match. */
  allNavHrefs?: string[];
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "onClick">) {
  const pathname = usePathname();
  const { optimisticPath, setOptimisticPath, startNavigation } = useNavigation();
  const currentPath = optimisticPath ?? pathname;
  const active = allNavHrefs?.length
    ? allNavHrefs
        .filter((h) => matchNavHref(currentPath, h))
        .sort((a, b) => b.length - a.length)[0] === href
    : matchNavHref(currentPath, href);

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
