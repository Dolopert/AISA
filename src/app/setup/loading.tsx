import { Card, PageSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="ตั้งค่า">
      <Card className="h-48" />
      <Card className="h-40" />
      <Card className="h-44" />
    </PageSkeleton>
  );
}
