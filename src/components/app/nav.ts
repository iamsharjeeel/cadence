import type { UserRole } from "@/types/db";

export type NavItem = {
  label: string;
  href: string;
  roles: UserRole[];
  icon: "dashboard" | "profile" | "employees" | "organizations" | "settings";
};

/**
 * Single source of truth for app navigation + access. The Sidebar renders only
 * the items whose `roles` include the caller's role. Server Components / Actions
 * re-check via `requireRole` — this list is for UI only.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    roles: ["superadmin", "admin", "employee"],
    icon: "dashboard",
  },
  {
    label: "Profile",
    href: "/app/profile",
    roles: ["superadmin", "admin", "employee"],
    icon: "profile",
  },
  {
    label: "Employees",
    href: "/app/employees",
    roles: ["admin"],
    icon: "employees",
  },
  {
    label: "Organizations",
    href: "/app/organizations",
    roles: ["superadmin"],
    icon: "organizations",
  },
  {
    label: "Settings",
    href: "/app/settings",
    roles: ["admin"],
    icon: "settings",
  },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
