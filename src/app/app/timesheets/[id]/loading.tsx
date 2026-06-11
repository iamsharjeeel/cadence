import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH } from "@/components/ui/Table";
import { TableRowsSkeleton } from "@/components/ui/Skeleton";
import { CardSkeleton } from "@/components/ui/Skeleton";

export default function TimesheetDetailLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <CardSkeleton bars={2} />
        <CardSkeleton bars={2} />
        <CardSkeleton bars={2} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Hours</TH>
                <TH>Project</TH>
                <TH>Description</TH>
                <TH>Billable</TH>
              </TR>
            </THead>
            <TBody>
              <TableRowsSkeleton rows={8} />
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
