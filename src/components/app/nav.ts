import type { UserRole } from "@/types/db";

export type NavItem = {
  label: string;
  href: string;
  roles: UserRole[];
  icon:
    | "dashboard"
    | "profile"
    | "timesheets"
    | "leave"
    | "employees"
    | "organizations"
    | "documents"
    | "projects"
    | "trends"
    | "settings"
    | "audit";
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    roles: ["superadmin", "admin", "employee"],
    icon: "dashboard",
  },
  {
    label: "Timesheets",
    href: "/app/timesheets",
    roles: ["superadmin", "admin", "employee"],
    icon: "timesheets",
  },
  {
    label: "Trends",
    href: "/app/trends",
    roles: ["superadmin", "admin", "employee"],
    icon: "trends",
  },
  {
    label: "Projects",
    href: "/app/projects",
    roles: ["superadmin", "admin", "employee"],
    icon: "projects",
  },
  {
    label: "Leave",
    href: "/app/leave",
    roles: ["superadmin", "admin", "employee"],
    icon: "leave",
  },
  {
    label: "Documents",
    href: "/app/documents",
    roles: ["superadmin", "admin", "employee"],
    icon: "documents",
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
    roles: ["superadmin", "admin"],
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
    roles: ["admin", "superadmin"],
    icon: "settings",
  },
  {
    label: "Audit log",
    href: "/app/audit",
    roles: ["admin", "superadmin"],
    icon: "audit",
  },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
