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
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-0.5">
        {orgName && (
          <div className="mb-0.5 flex items-center gap-2.5">
            <OrgLogo name={orgName} logoUrl={orgLogoUrl} size="md" />
            <span className="text-[13px] font-medium text-ink">{orgName}</span>
          </div>
        )}
        <h2
          className={
            greeting
              ? "font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[36px]"
              : "font-display text-xl font-semibold tracking-tightest"
          }
        >
          {title}
        </h2>
        {description && (
          <p
            className={
              greeting
                ? "max-w-xl font-body text-[15px] font-normal text-muted"
                : "max-w-xl text-[13px] text-muted"
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
