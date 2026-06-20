import type { UserRole } from "@/types/db";

export type NavItem = {
  label: string;
  href: string;
  roles: UserRole[];
  icon:
    | "dashboard"
    | "profile"
    | "timesheets"
    | "timeTracked"
    | "leave"
    | "employees"
    | "organizations"
    | "documents"
    | "projects"
    | "trends"
    | "reports"
    | "settings"
    | "userSettings"
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
    label: "Time tracked",
    href: "/app/time-tracked",
    roles: ["superadmin", "admin", "employee"],
    icon: "timeTracked",
  },
  {
    label: "Trends",
    href: "/app/trends",
    roles: ["superadmin", "admin", "employee"],
    icon: "trends",
  },
  {
    label: "Reports",
    href: "/app/reports",
    roles: ["superadmin", "admin", "employee"],
    icon: "reports",
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
    label: "Settings",
    href: "/app/user-settings",
    roles: ["superadmin", "admin", "employee"],
    icon: "userSettings",
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

/** Track C — workspace-context-driven navigation. */
export type NavContext = "personal" | "employee" | "manager" | "superadmin";

const CONTEXT_HREFS: Record<NavContext, string[]> = {
  // Solo product: time tracking, projects, leave, documents, profile.
  // Personal trends are folded into Dashboard; no standalone Trends route/nav.
  // No approvals / employees / settings / audit.
  personal: [
    "/app/dashboard",
    "/app/timesheets",
    "/app/time-tracked",
    "/app/projects",
    "/app/leave",
    "/app/documents",
    "/app/reports",
    "/app/profile",
    "/app/user-settings",
  ],
  // Same surface as personal, but org-scoped (can submit for approval).
  employee: [
    "/app/dashboard",
    "/app/timesheets",
    "/app/time-tracked",
    "/app/trends",
    "/app/reports",
    "/app/projects",
    "/app/leave",
    "/app/documents",
    "/app/profile",
    "/app/user-settings",
  ],
  // Org owner/admin: solo surface + team management.
  manager: [
    "/app/dashboard",
    "/app/timesheets",
    "/app/time-tracked",
    "/app/trends",
    "/app/reports",
    "/app/projects",
    "/app/leave",
    "/app/documents",
    "/app/profile",
    "/app/user-settings",
    "/app/employees",
    "/app/settings",
    "/app/audit",
  ],
  // Platform oversight: personal surface + cross-org organizations + audit.
  superadmin: [
    "/app/dashboard",
    "/app/timesheets",
    "/app/time-tracked",
    "/app/trends",
    "/app/reports",
    "/app/projects",
    "/app/leave",
    "/app/documents",
    "/app/profile",
    "/app/user-settings",
    "/app/employees",
    "/app/organizations",
    "/app/settings",
    "/app/audit",
  ],
};

export function navForContext(ctx: NavContext): NavItem[] {
  const byHref = new Map(NAV_ITEMS.map((i) => [i.href, i]));
  return CONTEXT_HREFS[ctx]
    .map((href) => {
      const item = byHref.get(href);
      if (!item) return null;
      if (ctx === "superadmin" && href === "/app/employees") {
        return { ...item, label: "Members" };
      }
      if (ctx === "manager" && href === "/app/employees") {
        return { ...item, label: "Organization" };
      }
      if (
        (ctx === "manager" || ctx === "superadmin") &&
        href === "/app/settings"
      ) {
        return { ...item, label: "Org settings" };
      }
      return item;
    })
    .filter((i): i is NavItem => Boolean(i));
}
