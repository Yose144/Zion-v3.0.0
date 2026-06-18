export default function DashboardLoading() {
  return (
    <div className="min-h-screen pt-28 pb-24 px-4">
      <div className="zion-container max-w-7xl space-y-10">
        {/* Hero skeleton */}
        <div className="rounded-4xl border border-white/10 bg-black/60 p-10 animate-pulse">
          <div className="h-6 w-56 rounded-full bg-white/10 mb-6" />
          <div className="h-12 w-80 rounded-lg bg-white/10 mb-4" />
          <div className="h-4 w-full max-w-xl rounded bg-white/5 mb-2" />
          <div className="h-4 w-96 rounded bg-white/5" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 h-24" />
            ))}
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-2 h-14 animate-pulse" />

        {/* Content skeleton */}
        <div className="space-y-6 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-4xl border border-white/10 bg-black/40 p-8 h-64" />
          ))}
        </div>
      </div>
    </div>
  );
}
