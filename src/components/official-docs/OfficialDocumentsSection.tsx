"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import type { OfficialDocument } from "@/types/db";
import { currentSearchParams } from "@/lib/search-params";
import { OfficialDocumentsPanel } from "./OfficialDocumentsPanel";
import { OfficialDocumentUploadModal } from "./OfficialDocumentUploadModal";

export function OfficialDocumentsSection({
  documents,
  isManager,
  isSuperadmin,
  employees,
  orgOptions,
  selectedOrgId,
  downloadUrls,
}: {
  documents: (OfficialDocument & { employee_name?: string })[];
  isManager: boolean;
  isSuperadmin: boolean;
  employees: { id: string; name: string; org_id?: string }[];
  orgOptions?: { id: string; name: string }[];
  selectedOrgId?: string;
  downloadUrls: Record<string, string>;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const orgId = selectedOrgId ?? orgOptions?.[0]?.id ?? "";

  const filteredEmployees = useMemo(() => {
    if (!isSuperadmin || !orgId) return employees;
    return employees.filter((e) => e.org_id === orgId);
  }, [employees, isSuperadmin, orgId]);

  function setOrg(id: string) {
    const next = currentSearchParams(searchParams);
    next.set("tab", "official");
    if (id) next.set("org", id);
    else next.delete("org");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const urlMap = new Map(Object.entries(downloadUrls));

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Official documents</CardTitle>
            <CardDescription>
              Contracts, policies, and documents requiring signature or
              acknowledgement.
            </CardDescription>
          </div>
          {isManager && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              Upload document
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isSuperadmin && orgOptions && orgOptions.length > 0 && (
            <div className="border-b px-6 py-4">
              <Select
                label="Organization"
                value={orgId}
                onChange={(e) => setOrg(e.target.value)}
                className="h-10 max-w-md text-sm"
                options={orgOptions.map((o) => ({
                  label: o.name,
                  value: o.id,
                }))}
              />
            </div>
          )}
          {documents.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="No official documents"
                description={
                  isManager
                    ? "Upload a contract or policy for your team."
                    : "Documents assigned to you will appear here."
                }
                action={
                  isManager ? (
                    <Button size="sm" onClick={() => setUploadOpen(true)}>
                      Upload document
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="px-2 py-2">
              <OfficialDocumentsPanel
                documents={documents}
                isManager={isManager}
                downloadUrls={urlMap}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {uploadOpen && (
        <OfficialDocumentUploadModal
          employees={filteredEmployees}
          orgOptions={isSuperadmin ? orgOptions : undefined}
          selectedOrgId={orgId}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </>
  );
}
