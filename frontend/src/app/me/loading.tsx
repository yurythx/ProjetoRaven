export default function MeLoading() {
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8 sm:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-[var(--rv-surface-2)]" />
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-[var(--rv-surface-2)]" />
            <div className="h-8 w-48 rounded bg-[var(--rv-surface-2)]" />
          </div>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-28 rounded-xl bg-[var(--rv-surface-2)]" />
          ))}
        </div>
      </div>

      {/* Characters skeleton */}
      <div className="mb-8 flex gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 w-40 rounded-xl bg-[var(--rv-surface-2)]" />
        ))}
      </div>

      <div className="h-px bg-[var(--rv-border)] mb-12" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-8">
          <div className="h-64 rounded-2xl bg-[var(--rv-surface-2)]" />
          <div className="h-48 rounded-2xl bg-[var(--rv-surface-2)]" />
        </div>
        <div className="lg:col-span-8 space-y-8">
          <div className="h-96 rounded-2xl bg-[var(--rv-surface-2)]" />
          <div className="h-48 rounded-2xl bg-[var(--rv-surface-2)]" />
        </div>
      </div>
    </div>
  );
}
