// ─── Skeleton loading placeholders (v2.9 glass) ──────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl shimmer ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)' }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div
      className="zion-panel p-5 space-y-3 flex-1 min-w-[150px]"
    >
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-2.5 w-1/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-xl shimmer animate-pulse"
      style={{ height, background: 'rgba(255,255,255,0.04)' }}
    />
  );
}
