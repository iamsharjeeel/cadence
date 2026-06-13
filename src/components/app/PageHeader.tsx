import { OrgLogo } from "@/components/brand/OrgLogo";

export function PageHeader({
  title,
  description,
  action,
  orgName,
  orgLogoUrl,
  greeting = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  orgName?: string;
  orgLogoUrl?: string | null;
  greeting?: boolean;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        {orgName && (
          <div className="mb-1 flex items-center gap-2.5">
            <OrgLogo name={orgName} logoUrl={orgLogoUrl} size="md" />
            <span className="text-sm font-medium text-ink">{orgName}</span>
          </div>
        )}
        <h2
          className={
            greeting
              ? "font-display text-[42px] font-bold leading-tight tracking-[-0.02em] text-ink"
              : "font-display text-2xl font-semibold tracking-tightest"
          }
        >
          {title}
        </h2>
        {description && (
          <p
            className={
              greeting
                ? "max-w-xl font-body text-[16px] font-normal text-muted"
                : "max-w-xl text-sm text-muted"
            }
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
