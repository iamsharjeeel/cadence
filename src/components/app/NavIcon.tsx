import type { NavItem } from "./nav";

const PATHS: Record<NavItem["icon"], React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  timesheets: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M8 3v3M16 3v3M8 11h8M8 15h5" />
    </>
  ),
  timeTracked: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  leave: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  expenses: (
    <>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 14h4" />
    </>
  ),
  employees: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.5a3 3 0 0 1 0 5.8M17.5 19a5.5 5.5 0 0 0-2.2-4.4" />
    </>
  ),
  organizations: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="1.5" />
      <path d="M9 20v-4h6v4M9 4h6v4H9z" />
    </>
  ),
  documents: (
    <>
      <path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M14 4v5h5M9 13h6M9 17h4" />
    </>
  ),
  projects: (
    <>
      <path d="M4 20h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H8l-4 4z" />
      <path d="M8 4v4H4" />
    </>
  ),
  trends: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </>
  ),
  reports: (
    <>
      <path d="M6 20V10M12 20V4M18 20v-7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  userSettings: (
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </>
  ),
  audit: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
};

export function NavIcon({ name }: { name: NavItem["icon"] }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
