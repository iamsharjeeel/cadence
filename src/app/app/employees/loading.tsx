import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH } from "@/components/ui/Table";
import { CardSkeleton, TableRowsSkeleton } from "@/components/ui/Skeleton";

export default function EmployeesLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-40 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-[var(--line)]" />
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Member</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              <TableRowsSkeleton rows={7} />
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
