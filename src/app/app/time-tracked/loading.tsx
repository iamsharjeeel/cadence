import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH } from "@/components/ui/Table";
import { CardSkeleton, TableRowsSkeleton } from "@/components/ui/Skeleton";

export default function TimeTrackedLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-36 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <CardSkeleton bars={2} />
      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Project</TH>
                <TH>Duration</TH>
                <TH>Started</TH>
                <TH>Status</TH>
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
