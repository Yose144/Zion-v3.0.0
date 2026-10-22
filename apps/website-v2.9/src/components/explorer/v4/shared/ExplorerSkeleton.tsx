"use client";

interface ExplorerSkeletonProps {
  statCount?: number;
}

/**
 * Consistent detail-page loading skeleton used by block, transaction
 * and address views. Mirrors the real layout so the switch to data
 * feels instant rather than jarring.
 */
export default function ExplorerSkeleton({ statCount = 4 }: ExplorerSkeletonProps) {
  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-zion-cyan/5 via-transparent to-transparent" />
      <div className="relative z-10 zion-container py-10 pt-6 max-w-6xl space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-32 bg-white/5 rounded" />
          <div className="h-14 w-full max-w-2xl bg-white/5 rounded-2xl" />
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-8 w-24 bg-white/5 rounded-full" />
            <div className="h-8 w-24 bg-white/5 rounded-full" />
          </div>
          <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(statCount, 4)} gap-3`}>
            {[...Array(statCount)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[320px] bg-white/5 rounded-3xl" />
            <div className="h-[320px] bg-white/5 rounded-3xl" />
          </div>
          <div className="h-64 bg-white/5 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
