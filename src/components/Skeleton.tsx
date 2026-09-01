/**
 * โครงหน้าเปล่าไว้แสดงระหว่างรอ server component
 *
 * ทุกหน้าเป็น force-dynamic — ถ้าไม่มี loading boundary Next จะค้างอยู่หน้าเดิม
 * เงียบ ๆ จนกว่าจะ render เสร็จ กดเมนูแล้วเหมือนแอปไม่ตอบสนอง
 */
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[var(--color-track)] ${className}`} />;
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageSkeleton({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="space-y-5">
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="animate-pulse space-y-5">{children}</div>
    </main>
  );
}
