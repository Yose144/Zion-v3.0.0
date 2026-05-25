export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-(--color-bg-hover) ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-(--color-bg-card) border border-(--color-border) rounded-lg p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
}
