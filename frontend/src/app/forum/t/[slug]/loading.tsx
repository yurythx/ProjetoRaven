export default function ForumTopicLoading() {
  return (
    <div className="relative min-h-screen animate-pulse">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        {/* Breadcrumb + badges */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <div className="h-3 w-14 rounded bg-[var(--rv-surface-2)]" />
            <div className="h-3 w-4 rounded bg-[var(--rv-surface-2)]" />
            <div className="h-3 w-24 rounded bg-[var(--rv-surface-2)]" />
            <div className="h-3 w-4 rounded bg-[var(--rv-surface-2)]" />
            <div className="h-3 w-36 rounded bg-[var(--rv-surface-2)]" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-20 rounded-full bg-[var(--rv-surface-2)]" />
            <div className="h-5 w-20 rounded-full bg-[var(--rv-surface-2)]" />
          </div>
        </div>

        {/* Topic card */}
        <div className="rounded-2xl bg-[var(--rv-surface-2)] p-6 sm:p-8 mb-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-[var(--rv-border)]" />
            <div className="h-3 w-28 rounded bg-[var(--rv-border)]" />
          </div>
          <div className="h-9 w-full rounded-lg bg-[var(--rv-border)]" />
          <div className="h-9 w-2/3 rounded-lg bg-[var(--rv-border)]" />
          <div className="space-y-2 pt-4">
            {[100, 92, 88, 100, 75, 95, 100, 68].map((w, i) => (
              <div key={i} className="h-3 rounded bg-[var(--rv-border)]" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>

        {/* Replies header */}
        <div className="h-5 w-32 rounded-full bg-[var(--rv-surface-2)] mb-6 mt-10" />

        {/* Reply cards */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-[var(--rv-border)]" />
                <div className="h-3 w-24 rounded bg-[var(--rv-border)]" />
                <div className="h-3 w-20 rounded bg-[var(--rv-border)] ml-2" />
              </div>
              <div className="space-y-2">
                {[100, 88, 72].map((w, j) => (
                  <div key={j} className="h-3 rounded bg-[var(--rv-border)]" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Reply composer skeleton */}
        <div className="mt-10 rounded-2xl bg-[var(--rv-surface-2)] h-52" />
      </div>
    </div>
  );
}
