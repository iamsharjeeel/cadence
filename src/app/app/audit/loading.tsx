import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH } from "@/components/ui/Table";
import { CardSkeleton, TableRowsSkeleton } from "@/components/ui/Skeleton";

export default function AuditLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <CardSkeleton bars={3} />
      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
              </TR>
            </THead>
            <TBody>
              <TableRowsSkeleton rows={10} />
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
