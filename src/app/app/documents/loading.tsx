import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH } from "@/components/ui/Table";
import { CardSkeleton, TableRowsSkeleton } from "@/components/ui/Skeleton";

export default function DocumentsLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-36 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-[var(--line)]" />
        ))}
      </div>
      <CardSkeleton bars={2} />
      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Number</TH>
                <TH>Period</TH>
                <TH>Total</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              <TableRowsSkeleton rows={6} />
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
