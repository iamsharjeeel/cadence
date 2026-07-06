import { CardSkeleton } from "@/components/ui/Skeleton";

export default function ExpensesLoading() {
  return (
    <div className="space-y-4">
      <CardSkeleton bars={2} />
      <CardSkeleton bars={6} />
      <CardSkeleton bars={8} />
    </div>
  );
}
