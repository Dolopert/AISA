import { Bar, Card, PageSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="ภาพรวม">
      <Card className="space-y-3 p-5">
        <Bar className="h-3 w-20" />
        <Bar className="h-12 w-32" />
        <Bar className="h-2 w-full" />
      </Card>
      <Card className="h-24" />
      <Card className="h-72" />
      <Card className="h-40" />
    </PageSkeleton>
  );
}
