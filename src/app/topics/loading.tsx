import { Card, PageSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="จุดอ่อน">
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i} className="h-24" />
      ))}
      <Card className="h-64" />
    </PageSkeleton>
  );
}
