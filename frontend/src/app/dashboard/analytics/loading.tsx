export default function AnalyticsLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 animate-pulse">
      {/* Header */}
      <div className="space-y-4 mb-12">
        <div className="h-5 w-24 rounded-full bg-[var(--rv-surface-2)]" />
        <div className="h-14 w-72 rounded-lg bg-[var(--rv-surface-2)]" />
        <div className="h-3 w-48 rounded bg-[var(--rv-surface-2)]" />
      </div>

      {/* User stat cards */}
      <div className="space-y-8">
        <div>
          <div className="h-3 w-20 rounded bg-[var(--rv-surface-2)] mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] h-28" />
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-2xl bg-[var(--rv-surface-2)] h-72" />

        {/* Game stat cards */}
        <div>
          <div className="h-3 w-16 rounded bg-[var(--rv-surface-2)] mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] h-28" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="rounded-2xl bg-[var(--rv-surface-2)] h-28" />
            <div className="rounded-2xl bg-[var(--rv-surface-2)] h-28" />
          </div>
        </div>

        {/* Content stats */}
        <div>
          <div className="h-3 w-20 rounded bg-[var(--rv-surface-2)] mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] h-28" />
            ))}
          </div>
        </div>

        {/* Top players */}
        <div className="rounded-2xl bg-[var(--rv-surface-2)] p-6 space-y-4">
          <div className="h-3 w-28 rounded bg-[var(--rv-border)]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded bg-[var(--rv-border)]" />
                <div className="h-3 w-32 rounded bg-[var(--rv-border)]" />
              </div>
              <div className="h-3 w-16 rounded bg-[var(--rv-border)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
