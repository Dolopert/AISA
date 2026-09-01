import { Card, PageSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton title="ทำข้อสอบ">
      <Card className="h-56" />
      <Card className="h-64" />
    </PageSkeleton>
  );
}
