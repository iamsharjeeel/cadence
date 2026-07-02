import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH } from "@/components/ui/Table";
import { CardSkeleton, TableRowsSkeleton } from "@/components/ui/Skeleton";

export default function TimesheetsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="h-8 w-40 animate-pulse rounded bg-[var(--line)]" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[var(--line)]" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <CardSkeleton bars={2} />
      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Period</TH>
                <TH>Status</TH>
                <TH>Hours</TH>
                <TH>Entries</TH>
                <TH>Submitted</TH>
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
