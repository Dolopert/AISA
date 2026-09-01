import { Bar, Card, PageSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="แผนการอ่าน">
      <Card className="space-y-3 p-5">
        <Bar className="h-3 w-20" />
        <Bar className="h-12 w-32" />
        <Bar className="h-2 w-full" />
      </Card>
      <div className="grid grid-cols-3 gap-2">
        <Card className="h-14" />
        <Card className="h-14" />
        <Card className="h-14" />
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="h-16" />
      ))}
    </PageSkeleton>
  );
}
